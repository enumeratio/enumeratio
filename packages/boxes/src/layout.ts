// Layout: boxes to a display list (https://github.com/enumeratio/enumeratio/wiki/Speculative-Box-Primitives, §4).
// Pure, with no DOM: positioned text runs, rules and rectangles, and slots, the rooms reserved for
// a leaf the environment draws itself (a figure, a typeset math run). Layout never draws an
// interactive thing; it reserves its room. The measures come from `Metrics`, so the same walk
// lays out a web page's pixels, a terminal's character cells (`cell`) or a native view's points.
//
// v0 covers rows, grids (spans, alignment, rules), panels and frames, panes, and the slots. On
// cells it also writes a small math (stacked fractions, raised scripts); elsewhere a math run is
// a slot for the environment's typesetter.

import {
  type Box,
  type BoxNode,
  isControlBoxHead,
  isNode,
  type Options,
  type OptionValue,
  optionsOfBox,
} from "./box.ts";
import { barOf } from "./control-group.ts";

export interface Font {
  /** In the metrics' own units (points, pixels); ignored by a cell metric. */
  readonly size: number;
  readonly weight?: "Bold";
  readonly slant?: "Italic";
}

/** What boxes inherit: the font and color a `StyleBox` changes. */
export interface Style {
  readonly font: Font;
  readonly color?: string;
}

export const DEFAULT_STYLE: Style = { font: { size: 16 } };

export interface Size {
  readonly width: number;
  readonly height: number;
  /** From the top to the line text sits on; `height` when absent. */
  readonly baseline?: number;
}

export interface Metrics {
  /** A run of text in `font`. */
  measure(text: string, font: Font): { advance: number; ascent: number; descent: number };
  /** The room a leaf needs: a typeset run, a control, a graphic, sized by the environment. */
  leaf(box: Box): Size;
  /** The unit relative spacings are in. */
  readonly em: number;
  /** Positions are whole character cells, and frames and rules are drawn with box-drawing characters. */
  readonly cell?: boolean;
}

export type Item =
  | {
      readonly kind: "text";
      readonly x: number;
      readonly y: number;
      readonly text: string;
      readonly font: Font;
      readonly color?: string;
    }
  /** A rule: `length` along the row (or the column, when `vertical`) from (x, y). */
  | { readonly kind: "rule"; readonly x: number; readonly y: number; readonly length: number; readonly vertical?: true }
  /** A rectangle: filled, outlined, or both. */
  | {
      readonly kind: "rect";
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
      readonly fill?: string;
      readonly stroke?: true;
    }
  /** A room for a leaf the environment draws. */
  | {
      readonly kind: "slot";
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
      readonly box: Box;
    }
  /** Items clipped to a window: a `PaneBox`, scrolling or scaled to fit. */
  | {
      readonly kind: "group";
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
      readonly items: readonly Item[];
      readonly scale?: number;
      readonly scroll?: true;
    };

export interface DisplayList {
  readonly width: number;
  readonly height: number;
  /** From the top to the line the content sits on. */
  readonly baseline: number;
  readonly items: readonly Item[];
}

/**
 * Where a grid's rows come from. An array is one; a producer that makes a row when it is
 * asked for it (a long table's) is another, so layout and renderers read rows through this
 * and never assume they are all there.
 */
export interface GridRows {
  readonly length: number;
  row(index: number): readonly Box[];
}

/** An array of rows, or a producer, as rows. */
export const rowsOf = (rows: readonly (readonly Box[])[] | GridRows): GridRows =>
  Array.isArray(rows)
    ? { length: rows.length, row: (index) => (rows as readonly (readonly Box[])[])[index] ?? [] }
    : (rows as GridRows);

/** A grid cell as laid: its place, the places it spans, and what it holds. */
export interface GridCell {
  readonly r: number;
  readonly c: number;
  rows: number;
  cols: number;
  readonly box: Box;
}

/**
 * The cells of a grid, short rows padded and spans resolved: a cell that is Wolfram's
 * `SpanFromLeft` (or `SpanFromAbove`) continues the cell on its left (above), which grows to cover it.
 * `owner` says which cell holds each place.
 */
export function gridCells(source: GridRows): { columns: number; owner: number[][]; anchors: GridCell[] } {
  const columns = Math.max(0, ...Array.from({ length: source.length }, (_, i) => source.row(i).length));
  const owner: number[][] = [];
  const anchors: GridCell[] = [];
  for (let i = 0; i < source.length; i++) {
    owner.push([]);
    const entries = source.row(i);
    for (let c = 0; c < columns; c++) {
      const entry = entries[c];
      const parent =
        entry === "SpanFromLeft" && c > 0
          ? owner[i]![c - 1]!
          : entry === "SpanFromAbove" && i > 0
            ? owner[i - 1]![c]!
            : -1;
      if (parent >= 0) {
        owner[i]!.push(parent);
        const a = anchors[parent]!;
        a.cols = Math.max(a.cols, c - a.c + 1);
        a.rows = Math.max(a.rows, i - a.r + 1);
      } else {
        owner[i]!.push(anchors.length);
        anchors.push({ r: i, c, rows: 1, cols: 1, box: entry ?? "" });
      }
    }
  }
  return { columns, owner, anchors };
}

// ── Spacing ──────────────────────────────────────────────────────────────────────────────

/** The gaps layout leaves, in em (cells on a cell metric, where a gap is a whole number of them). */
interface Rhythm {
  readonly rowGap: number;
  readonly columnGap: number;
  readonly gridColumns: number;
  readonly gridRows: number;
  readonly panelX: number;
  readonly panelY: number;
  readonly frameX: number;
  readonly frameY: number;
  readonly cellX: number;
  readonly cellY: number;
  readonly asideGap: number;
  readonly stackedGap: number;
  readonly rule: number;
}

const EM: Rhythm = {
  rowGap: 0.6,
  columnGap: 0.5,
  gridColumns: 0.8,
  gridRows: 0.4,
  panelX: 0.9,
  panelY: 0.6,
  frameX: 0.3,
  frameY: 0.15,
  cellX: 0.4,
  cellY: 0.2,
  asideGap: 0.4,
  stackedGap: 0.15,
  rule: 1,
};

const CELLS: Rhythm = {
  rowGap: 1,
  columnGap: 0,
  gridColumns: 2,
  gridRows: 0,
  panelX: 1,
  panelY: 0,
  frameX: 1,
  frameY: 0,
  cellX: 1,
  cellY: 0,
  asideGap: 1,
  stackedGap: 0,
  rule: 1,
};

// ── Laid-out pieces ──────────────────────────────────────────────────────────────────────

interface Laid {
  readonly width: number;
  readonly height: number;
  readonly baseline: number;
  readonly items: readonly Item[];
}

const EMPTY: Laid = { width: 0, height: 0, baseline: 0, items: [] };

function shift(item: Item, dx: number, dy: number): Item {
  return dx === 0 && dy === 0 ? item : { ...item, x: item.x + dx, y: item.y + dy };
}

const moved = (laid: Laid, dx: number, dy: number): readonly Item[] => laid.items.map((item) => shift(item, dx, dy));

const optionString = (value: OptionValue | undefined): string | undefined =>
  typeof value === "string" ? value : undefined;
const optionNumber = (value: OptionValue | undefined): number | undefined =>
  typeof value === "number" ? value : undefined;

// ── Grid axes ────────────────────────────────────────────────────────────────────────────

/** One direction of a grid: the content sizes of its columns (or rows) and the room around them. */
interface Axis {
  readonly sizes: number[];
  /** On each side of a cell, when the grid is ruled. */
  readonly pad: number;
  /** Between neighbors: a rule, or a gap. */
  readonly sep: number;
  /** Outside the first and last: the frame. */
  readonly edge: number;
}

/** Where each place's padded box starts. */
function starts(axis: Axis): number[] {
  const out: number[] = [];
  let at = axis.edge;
  for (const size of axis.sizes) {
    out.push(at);
    at += size + 2 * axis.pad + axis.sep;
  }
  return out;
}

/** The whole length of an axis. */
const extent = (axis: Axis, from: readonly number[]): number =>
  axis.sizes.length === 0 ? 0 : from.at(-1)! + axis.sizes.at(-1)! + 2 * axis.pad + axis.edge;

/** The content room of a cell spanning `count` places from `first`. */
function roomOf(axis: Axis, from: readonly number[], first: number, count: number): number {
  const last = first + count - 1;
  return from[last]! + axis.sizes[last]! - from[first]!;
}

/** Make a span of `count` places from `first` wide enough for `need`, in its last place. */
function grow(axis: Axis, first: number, count: number, need: number): void {
  const have = roomOf(axis, starts(axis), first, count);
  if (need > have) axis.sizes[first + count - 1]! += need - have;
}

/** The ranges `[from, to]` of places where `open` holds. */
function runs(count: number, open: (k: number) => boolean): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 0; k < count; k++) {
    if (!open(k)) continue;
    const last = out.at(-1);
    if (last !== undefined && last[1] === k - 1) last[1] = k;
    else out.push([k, k]);
  }
  return out;
}

/** A rule along places `first..last` of an axis, `at` across it; to the frame where the run reaches an end. */
function ruleAlong(
  axis: Axis,
  from: readonly number[],
  first: number,
  last: number,
  frame: boolean,
  total: number,
  at: number,
  vertical = false,
): Item {
  const start = first === 0 && frame ? 0 : from[first]!;
  const end = last === axis.sizes.length - 1 && frame ? total : from[last]! + axis.sizes[last]! + 2 * axis.pad;
  return vertical
    ? { kind: "rule", x: at, y: start, length: end - start, vertical: true }
    : { kind: "rule", x: start, y: at, length: end - start };
}

// ── The walk ─────────────────────────────────────────────────────────────────────────────

class Layout {
  readonly rhythm: Rhythm;
  constructor(readonly metrics: Metrics) {
    this.rhythm = metrics.cell ? CELLS : EM;
  }

  /** `k` em, or `k` cells. */
  gap(k: number): number {
    return this.metrics.cell ? k : k * this.metrics.em;
  }

  text(text: string, style: Style): Laid {
    const { advance, ascent, descent } = this.metrics.measure(text, style.font);
    const item: Item = { kind: "text", x: 0, y: 0, text, font: style.font, ...(style.color && { color: style.color }) };
    return { width: advance, height: ascent + descent, baseline: ascent, items: text === "" ? [] : [item] };
  }

  slot(box: Box): Laid {
    const { width, height, baseline } = this.metrics.leaf(box);
    return { width, height, baseline: baseline ?? height, items: [{ kind: "slot", x: 0, y: 0, width, height, box }] };
  }

  /** Children side by side on one baseline, `gap` apart (or `gaps[i]` before child `i`). */
  across(children: readonly Laid[], gap: number | ((before: number) => number)): Laid {
    if (children.length === 0) return EMPTY;
    const baseline = Math.max(...children.map((c) => c.baseline));
    const below = Math.max(...children.map((c) => c.height - c.baseline));
    const items: Item[] = [];
    let x = 0;
    children.forEach((child, i) => {
      if (i > 0) x += typeof gap === "number" ? gap : gap(i);
      items.push(...moved(child, x, baseline - child.baseline));
      x += child.width;
    });
    return { width: x, height: baseline + below, baseline, items };
  }

  lay(box: Box, style: Style): Laid {
    if (typeof box === "string") return this.text(box, style);
    switch (box[0]) {
      case "TextBox":
        return this.text(box[1], style);
      case "RowBox":
        return this.row(box[1], style, 0);
      case "TextData":
        return this.across(
          box[1].map((b) => this.lay(b, style)),
          0,
        );
      case "TagBox":
        return this.tagged(box, style);
      case "GridBox":
        // A bar is one control, drawn whole by the environment.
        return barOf(box) === undefined ? this.grid(box, style, "") : this.slot(box);
      case "PanelBox":
        return this.framed(box[1], style, this.rhythm.panelX, this.rhythm.panelY, true);
      case "FrameBox":
        return this.framed(box[1], style, this.rhythm.frameX, this.rhythm.frameY, false);
      case "PaneBox":
        return this.pane(box, style);
      case "StyleBox":
        return this.lay(box[1], styled(style, box[2]));
      case "InterpretationBox":
      case "ErrorBox":
      case "ButtonBox":
      case "TextCell":
        return this.lay(box[1], style);
      case "FormBox":
        return box[2] === "TeXForm" ? this.slot(box) : this.lay(box[1], style);
      case "TemplateSlot":
      case "TemplateExpression":
      case "GraphicsBox":
      case "GraphicsComplexBox":
      case "DiskBox":
      case "LineBox":
      case "PointBox":
      case "ArrowBox":
      case "RectangleBox":
      case "PolygonBox":
      case "PolyhedronBox":
      case "InsetBox":
      case "TableViewBox":
      case "DynamicBox":
        return this.slot(box);
      case "DynamicModuleBox":
        return this.lay(box[1], style);
      default:
        // A control is a leaf the environment draws and the reader moves.
        return isControlBoxHead(box[0]) ? this.slot(box) : this.math(box, style);
    }
  }

  /** A `TagBox` that names a layout formatter gives its box that formatter's look. */
  tagged(box: Extract<BoxNode, readonly ["TagBox", ...unknown[]]>, style: Style): Laid {
    const [, inner, name] = box;
    if (isNode(inner) && inner[0] === "RowBox" && name === "Row") {
      return this.across(
        inner[1].map((b) => this.lay(b, style)),
        this.gap(this.rhythm.rowGap),
      );
    }
    if (isNode(inner) && inner[0] === "GridBox") return this.grid(inner, style, name);
    return this.lay(inner, style);
  }

  // ── Rows of math tokens ──

  row(items: readonly Box[], style: Style, gap: number): Laid {
    // Running tokens (`x + 1`) are one run of text: spaced around operators, not between letters.
    if (items.length > 0 && items.every((b) => typeof b === "string")) {
      return this.text(spaced(items as readonly string[]), style);
    }
    const laid = items.map((b) => this.lay(b, style));
    const high = Math.max(0, ...laid.map((l) => l.height));
    const stretched = laid.map((l, i) => (high > 1 && this.metrics.cell ? this.stretched(items[i]!, l, laid) : l));
    const space = this.metrics.measure(" ", style.font).advance;
    return this.across(stretched, (i) => gap + (spaceBetween(items[i - 1]!, items[i]!, items, i) ? space : 0));
  }

  /** A fence next to something taller than a line is drawn as tall as it. */
  stretched(box: Box, own: Laid, siblings: readonly Laid[]): Laid {
    const pieces = typeof box === "string" ? FENCES[box] : undefined;
    if (pieces === undefined) return own;
    const height = Math.max(...siblings.map((l) => l.height));
    if (height < 2) return own;
    const baseline = Math.max(...siblings.map((l) => l.baseline));
    const text = (c: string, y: number): Item => ({ kind: "text", x: 0, y, text: c, font: { size: 1 } });
    const items = Array.from({ length: height }, (_, y) =>
      text(y === 0 ? pieces[0] : y === height - 1 ? pieces[2] : pieces[1], y),
    );
    return { width: 1, height, baseline, items };
  }

  // ── Grids ──

  grid(box: Extract<BoxNode, readonly ["GridBox", ...unknown[]]>, style: Style, name: string): Laid {
    const rows = rowsOf(box[1]);
    const options = optionsOfBox(box);
    const r = this.rhythm;
    const defaults = GRID_DEFAULTS[name] ?? GRID_DEFAULTS[""]!;
    const frame = options.GridBoxFrame === true;
    const dividers = optionString(options.GridBoxDividers) === "All";
    const ruled = frame || dividers;
    const stacked = name === "Labeled" && rows.length > 1;

    const { columns, owner, anchors } = gridCells(rows);
    const laid = anchors.map((a) => this.lay(a.box, style));

    const t = ruled ? this.gap(r.rule) : 0;
    const spacingX = optionNumber(options.ColumnSpacings);
    const spacingY = optionNumber(options.RowSpacings);
    const across: Axis = {
      sizes: Array.from({ length: columns }, () => 0),
      pad: ruled ? this.gap(r.cellX) : 0,
      sep: dividers ? t : ruled ? 0 : this.gap(spacingX ?? defaults.columns(r, stacked)),
      edge: frame ? t : 0,
    };
    const down: Axis = {
      sizes: Array.from({ length: rows.length }, () => 0),
      pad: ruled ? this.gap(r.cellY) : 0,
      sep: dividers ? t : ruled ? 0 : this.gap(spacingY ?? defaults.rows(r, stacked)),
      edge: frame ? t : 0,
    };

    // Single cells size their column and row; a span then takes what it still needs.
    anchors.forEach((a, i) => {
      if (a.cols === 1) across.sizes[a.c] = Math.max(across.sizes[a.c]!, laid[i]!.width);
      if (a.rows === 1) down.sizes[a.r] = Math.max(down.sizes[a.r]!, laid[i]!.height);
    });
    anchors.forEach((a, i) => {
      if (a.cols > 1) grow(across, a.c, a.cols, laid[i]!.width);
      if (a.rows > 1) grow(down, a.r, a.rows, laid[i]!.height);
    });
    const [xs, ys] = [starts(across), starts(down)];

    const items: Item[] = [];
    anchors.forEach((a, i) => {
      const l = laid[i]!;
      const room = roomOf(across, xs, a.c, a.cols);
      const high = roomOf(down, ys, a.r, a.rows);
      const aligned = options.ColumnAlignments;
      const align = (Array.isArray(aligned) ? optionString(aligned[a.c]) : optionString(aligned)) ?? defaults.align;
      const dx = align === "Right" ? room - l.width : align === "Center" ? Math.floor((room - l.width) / 2) : 0;
      items.push(...moved(l, xs[a.c]! + across.pad + dx, ys[a.r]! + down.pad + Math.floor((high - l.height) / 2)));
    });

    const width = extent(across, xs);
    const height = extent(down, ys);
    if (frame && columns > 0 && rows.length > 0) items.push({ kind: "rect", x: 0, y: 0, width, height, stroke: true });
    if (dividers) {
      const blockedBelow = (i: number, c: number): boolean => owner[i]![c] === owner[i + 1]![c];
      const blockedRight = (i: number, c: number): boolean => owner[i]![c] === owner[i]![c + 1];
      for (let i = 0; i < rows.length - 1; i++)
        for (const [from, to] of runs(columns, (c) => !blockedBelow(i, c)))
          items.push(ruleAlong(across, xs, from, to, frame, width, ys[i]! + down.sizes[i]! + 2 * down.pad));
      for (let c = 0; c < columns - 1; c++)
        for (const [from, to] of runs(rows.length, (i) => !blockedRight(i, c)))
          items.push(ruleAlong(down, ys, from, to, frame, height, xs[c]! + across.sizes[c]! + 2 * across.pad, true));
    }

    const { ascent, descent } = this.metrics.measure("x", style.font);
    const baseline = this.metrics.cell ? Math.ceil(height / 2) : height / 2 + (ascent - descent) / 2;
    return { width, height, baseline, items };
  }

  // ── Frames and panes ──

  framed(inner: Box, style: Style, padX: number, padY: number, panel: boolean): Laid {
    const content = this.lay(inner, style);
    const t = this.gap(this.rhythm.rule);
    const [px, py] = [this.gap(padX), this.gap(padY)];
    const width = content.width + 2 * (px + t);
    const height = content.height + 2 * (py + t);
    const rect: Item = { kind: "rect", x: 0, y: 0, width, height, stroke: true, ...(panel && { fill: "panel" }) };
    return { width, height, baseline: content.baseline + py + t, items: [rect, ...moved(content, px + t, py + t)] };
  }

  pane(box: Extract<BoxNode, readonly ["PaneBox", ...unknown[]]>, style: Style): Laid {
    const options = optionsOfBox(box);
    const content = this.lay(box[1], style);
    const size = options.ImageSize;
    const [w, h] = Array.isArray(size)
      ? [optionNumber(size[0]), optionNumber(size[1])]
      : [optionNumber(size), undefined];
    const width = w ?? content.width;
    const height = h ?? content.height;
    const shrink = optionString(options.ImageSizeAction) === "ShrinkToFit" && !this.metrics.cell;
    const scale = shrink ? Math.min(1, width / (content.width || 1), height / (content.height || 1)) : 1;
    const overflows = content.width > width || content.height > height;
    const group: Item = {
      kind: "group",
      x: 0,
      y: 0,
      width,
      height,
      items: content.items,
      ...(scale < 1 && { scale }),
      ...(overflows &&
        scale === 1 &&
        options.Scrollbars !== undefined &&
        options.Scrollbars !== false && { scroll: true as const }),
    };
    return { width, height, baseline: Math.min(height, content.baseline * scale), items: [group] };
  }

  // ── Math ──

  /** A math box: a slot for the environment's typesetter, or on cells our own small math. */
  math(box: BoxNode, style: Style): Laid {
    if (!this.metrics.cell) return this.slot(box);
    switch (box[0]) {
      case "FractionBox":
        return this.fraction(box, style);
      case "SuperscriptBox":
        return this.scripted(box[1], undefined, box[2], style);
      case "SubscriptBox":
        return this.scripted(box[1], box[2], undefined, style);
      case "SubsuperscriptBox":
        return this.scripted(box[1], box[2], box[3], style);
      case "SqrtBox":
        return this.radical(box[1], undefined, style);
      case "RadicalBox":
        return this.radical(box[1], box[2], style);
      case "OverscriptBox":
        return this.stackedAbout(box[1], undefined, box[2], style);
      case "UnderscriptBox":
        return this.stackedAbout(box[1], box[2], undefined, style);
      case "UnderoverscriptBox":
        return this.stackedAbout(box[1], box[2], box[3], style);
      default:
        return this.text(plain(box), style);
    }
  }

  fraction(box: Extract<BoxNode, readonly ["FractionBox", ...unknown[]]>, style: Style): Laid {
    const [num, den] = [this.lay(box[1], style), this.lay(box[2], style)];
    const bar = optionsOfBox(box).FractionLine !== false;
    const width = Math.max(num.width, den.width) + (bar ? 2 : 0);
    const items = [
      ...moved(num, Math.floor((width - num.width) / 2), 0),
      ...(bar ? [{ kind: "rule", x: 0, y: num.height, length: width } as Item] : []),
      ...moved(den, Math.floor((width - den.width) / 2), num.height + (bar ? 1 : 0)),
    ];
    return { width, height: num.height + (bar ? 1 : 0) + den.height, baseline: num.height + (bar ? 1 : 0), items };
  }

  scripted(base: Box, sub: Box | undefined, sup: Box | undefined, style: Style): Laid {
    const b = this.lay(base, style);
    const inlineUp = sup === undefined ? "" : raised(plain(sup), SUPERSCRIPTS);
    const inlineDown = sub === undefined ? "" : raised(plain(sub), SUBSCRIPTS);
    const flat = (sup === undefined || inlineUp !== undefined) && (sub === undefined || inlineDown !== undefined);
    if (flat && sub === undefined) return this.across([b, this.text(inlineUp ?? "", style)], 0);
    if (flat && sup === undefined) return this.across([b, this.text(inlineDown ?? "", style)], 0);
    const up = sup === undefined ? EMPTY : this.lay(sup, style);
    const down = sub === undefined ? EMPTY : this.lay(sub, style);
    const side = Math.max(up.width, down.width);
    const x = b.width;
    const items = [...moved(up, x, 0), ...moved(b, 0, up.height), ...moved(down, x, up.height + b.height)];
    return { width: x + side, height: up.height + b.height + down.height, baseline: up.height + b.baseline, items };
  }

  radical(radicand: Box, index: Box | undefined, style: Style): Laid {
    const inner = this.lay(radicand, style);
    const sign = this.text("√", style);
    const root = index === undefined ? EMPTY : this.lay(index, style);
    // A single token reads as `√x`; anything longer is fenced, since there is no vinculum to extend.
    const single = typeof radicand === "string" && Array.from(radicand).length <= 1;
    const body = single ? inner : this.across([this.text("(", style), inner, this.text(")", style)], 0);
    return this.across([root, sign, body], 0);
  }

  stackedAbout(base: Box, under: Box | undefined, over: Box | undefined, style: Style): Laid {
    if (over === "‾" && typeof base === "string")
      return this.text(
        base.replace(/./gu, (c) => `${c}̅`),
        style,
      );
    const [b, u, o] = [
      this.lay(base, style),
      under === undefined ? EMPTY : this.lay(under, style),
      over === undefined ? EMPTY : this.lay(over, style),
    ];
    const width = Math.max(b.width, u.width, o.width);
    const middle = (l: Laid): number => Math.floor((width - l.width) / 2);
    const items = [
      ...moved(o, middle(o), 0),
      ...moved(b, middle(b), o.height),
      ...moved(u, middle(u), o.height + b.height),
    ];
    return { width, height: o.height + b.height + u.height, baseline: o.height + b.baseline, items };
  }
}

/** Per-formatter looks: how a `TagBox`ed grid is aligned and spaced when it says nothing. */
const GRID_DEFAULTS: Readonly<
  Record<
    string,
    { align: string; columns: (r: Rhythm, stacked: boolean) => number; rows: (r: Rhythm, stacked: boolean) => number }
  >
> = {
  "": { align: "Center", columns: (r) => r.gridColumns, rows: (r) => r.gridRows },
  Grid: { align: "Center", columns: (r) => r.gridColumns, rows: (r) => r.gridRows },
  Column: { align: "Left", columns: (r) => r.gridColumns, rows: (r) => r.columnGap },
  Labeled: {
    align: "Left",
    columns: (r) => r.asideGap,
    rows: (r) => r.stackedGap,
  },
};

// ── Text helpers ─────────────────────────────────────────────────────────────────────────

function styled(style: Style, options: Options): Style {
  const color = optionString(options.FontColor);
  const size = optionNumber(options.FontSize);
  const font = {
    ...style.font,
    ...(size !== undefined && { size }),
    ...(options.FontWeight === "Bold" && { weight: "Bold" as const }),
    ...(options.FontSlant === "Italic" && { slant: "Italic" as const }),
  };
  return { font, ...((color ?? style.color) !== undefined && { color: (color ?? style.color)! }) };
}

const SPACED = new Set([
  "+",
  "−",
  "-",
  "=",
  "<",
  ">",
  "≤",
  "≥",
  "≠",
  "×",
  "÷",
  "±",
  "∓",
  "→",
  "↦",
  "∈",
  "∉",
  "⊂",
  "⊆",
  "∪",
  "∩",
  "≡",
  "≈",
  "mod",
]);
const OPENING = new Set(["(", "[", "{", "⟨", "|", ","]);

/** Tokens as running text: spaces around a binary operator and after a comma. */
function spaced(tokens: readonly string[]): string {
  let out = "";
  tokens.forEach((t, i) => {
    const binary =
      SPACED.has(t) && i > 0 && i < tokens.length - 1 && !SPACED.has(tokens[i - 1]!) && !OPENING.has(tokens[i - 1]!);
    out += binary ? ` ${t} ` : t;
    if (t === "," && i < tokens.length - 1) out += " ";
  });
  return out;
}

/** Whether a space goes before child `i` of a row that mixes tokens and boxes. */
function spaceBetween(before: Box, after: Box, items: readonly Box[], i: number): boolean {
  const binary = (b: Box, k: number): boolean =>
    typeof b === "string" &&
    SPACED.has(b) &&
    k > 0 &&
    k < items.length - 1 &&
    !(typeof items[k - 1] === "string" && (SPACED.has(items[k - 1] as string) || OPENING.has(items[k - 1] as string)));
  return binary(before, i - 1) || binary(after, i) || before === ",";
}

const FENCES: Readonly<Record<string, readonly [string, string, string]>> = {
  "(": ["⎛", "⎜", "⎝"],
  ")": ["⎞", "⎟", "⎠"],
  "[": ["⎡", "⎢", "⎣"],
  "]": ["⎤", "⎥", "⎦"],
  "|": ["│", "│", "│"],
};

const SUPERSCRIPTS: Readonly<Record<string, string>> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "+": "⁺",
  "−": "⁻",
  "-": "⁻",
  "=": "⁼",
  "(": "⁽",
  ")": "⁾",
  n: "ⁿ",
  i: "ⁱ",
};
const SUBSCRIPTS: Readonly<Record<string, string>> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
  "+": "₊",
  "−": "₋",
  "-": "₋",
  "=": "₌",
  "(": "₍",
  ")": "₎",
  a: "ₐ",
  e: "ₑ",
  o: "ₒ",
  x: "ₓ",
};

/** `text` in a script alphabet, or undefined when some character has no form there. */
function raised(text: string, alphabet: Readonly<Record<string, string>>): string | undefined {
  const out = Array.from(text).map((c) => alphabet[c]);
  return out.every((c) => c !== undefined) ? out.join("") : undefined;
}

/** A box as running text, for the cases layout has no picture for. */
function plain(box: Box): string {
  if (typeof box === "string") return box;
  switch (box[0]) {
    case "RowBox":
      return spaced(box[1].map(plain));
    case "TextData":
      return box[1].map(plain).join("");
    case "GridBox":
      return box[1].map((r) => r.map(plain).join(" ")).join(" ");
    case "TextBox":
      return box[1];
    case "TemplateSlot":
    case "TemplateExpression":
      return `\${${box[1]}}`;
    case "InterpretationBox":
    case "TagBox":
    case "StyleBox":
    case "FrameBox":
    case "PanelBox":
    case "PaneBox":
    case "ErrorBox":
    case "ButtonBox":
    case "TextCell":
    case "FormBox":
      return plain(box[1]);
    case "FractionBox":
      return `${plain(box[1])}/${plain(box[2])}`;
    case "SuperscriptBox":
      return `${plain(box[1])}^${plain(box[2])}`;
    case "SubscriptBox":
      return `${plain(box[1])}_${plain(box[2])}`;
    default:
      return "";
  }
}

/** Boxes laid out in `style` with `metrics`' measures: positions, text runs, rules and slots. */
export function layout(box: Box, style: Style, metrics: Metrics): DisplayList {
  const { width, height, baseline, items } = new Layout(metrics).lay(box, style);
  return { width, height, baseline, items };
}
