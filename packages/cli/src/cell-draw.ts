// The terminal's drawer of a `GraphicsBox` (https://github.com/enumeratio/enumeratio/wiki/Speculative-Box-Primitives):
// the boxes of a figure on a grid of character cells, with no layer code. Curves and points go
// on braille cells (2 × 4 dots each, as `textPlot` does) with a point as `●`; a figure of
// rectangles (a Young diagram) is ruled with box-drawing characters instead. Pure: boxes in,
// text out. Selection and hover are the web's; the marks' own colors are kept where the terminal has color.

import { type Box, isNode, optionsOfBox, type Options } from "@enumeratio/boxes";
import { complexOf, pinnedBox } from "@enumeratio/frontend";

type Point = readonly number[];

type Shape =
  | { readonly head: "Disk"; readonly center: Point }
  | { readonly head: "Line"; readonly points: readonly Point[]; readonly breaks: readonly number[] }
  | { readonly head: "Polygon"; readonly points: readonly Point[] }
  | { readonly head: "Text"; readonly text: string; readonly center: Point };

interface Mark {
  readonly shape: Shape;
  /** The color it fills with, or strokes with if it is a line. */
  readonly face?: string;
  /** The color of its topmost edge. */
  readonly edge?: string;
}

export interface CellOptions {
  /** Most columns the drawing may take (default 60). */
  readonly width?: number;
  /** Most rows (default 14). */
  readonly height?: number;
  /** Color the marks with ANSI (default false). */
  readonly color?: boolean;
}

const pointOf = (value: unknown): Point | undefined =>
  Array.isArray(value) && value.length >= 2 && value.every((v) => typeof v === "number") ? value : undefined;
const pointsOf = (value: unknown): Point[] =>
  Array.isArray(value) ? value.map(pointOf).filter((p): p is Point => p !== undefined) : [];

/** What the boxes of a `GraphicsBox` hold: its marks, captions and links as shapes with their colors. */
function marksOf(box: Box): Mark[] | undefined {
  const complex = complexOf(box);
  if (!complex) return undefined;
  const { Addresses, Places } = optionsOfBox(complex);
  const places = new Map<string, Point>();
  if (Array.isArray(Addresses) && Array.isArray(Places))
    Addresses.forEach((a, k) => {
      const place = pointOf(Places[k]);
      if (Array.isArray(a) && place) places.set(a.join(","), place);
    });
  const content = complex[1];
  const items = isNode(content) && content[0] === "RowBox" ? content[1] : [content];
  const out: Mark[] = [];
  for (const item of items) {
    let look: Options = {};
    let tagged = item;
    if (isNode(tagged) && tagged[0] === "StyleBox") {
      look = tagged[2];
      tagged = tagged[1];
    }
    if (!isNode(tagged) || tagged[0] !== "TagBox") continue;
    const prim = tagged[1];
    const at = places.get(tagged[2]);
    if (!isNode(prim)) continue;
    const o = optionsOfBox(prim);
    const edges = Array.isArray(look.EdgeForm) ? look.EdgeForm : [];
    const first = edges[0];
    const edge = Array.isArray(first) && typeof first[0] === "string" ? first[0] : undefined;
    const face = typeof look.FaceForm === "string" ? look.FaceForm : undefined;
    const base = { ...(face && { face }), ...(edge && { edge }) };
    switch (prim[0]) {
      case "DiskBox": {
        const center = pointOf(o.Center) ?? at;
        if (center) out.push({ ...base, shape: { head: "Disk", center } });
        break;
      }
      case "LineBox":
        out.push({
          ...base,
          shape: {
            head: "Line",
            points: pointsOf(o.Points),
            breaks: Array.isArray(o.Breaks) ? (o.Breaks as number[]) : [],
          },
        });
        break;
      case "PolygonBox":
        out.push({ ...base, shape: { head: "Polygon", points: pointsOf(o.Points) } });
        break;
      case "PolyhedronBox":
        for (const ring of Array.isArray(o.Faces) ? o.Faces : [])
          out.push({ ...base, shape: { head: "Polygon", points: pointsOf(ring) } });
        break;
      case "InsetBox": {
        const center = pointOf(o.Center) ?? at;
        if (center && typeof prim[1] === "string")
          out.push({ ...base, shape: { head: "Text", text: prim[1], center } });
        break;
      }
      default:
    }
  }
  return out;
}

// ── Color ────────────────────────────────────────────────────────────────────────────────

type Rgb = readonly [number, number, number];

/** A mark's CSS color (`#rrggbb` or `rgba(…)`) as channels. */
function rgbOf(css: string | undefined): Rgb | undefined {
  if (css === undefined) return undefined;
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(css);
  if (hex) return [parseInt(hex[1]!, 16), parseInt(hex[2]!, 16), parseInt(hex[3]!, 16)];
  const rgba = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(css);
  return rgba ? [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])] : undefined;
}

/** The SGR code for a foreground in the 256-color cube, which every color terminal speaks. */
function sgr([r, g, b]: Rgb): string {
  const level = (c: number): number => Math.round((c / 255) * 5);
  return `38;5;${16 + 36 * level(r) + 6 * level(g) + level(b)}`;
}

// ── Cells ────────────────────────────────────────────────────────────────────────────────

const BRAILLE = 0x2800;
// Dot bits by (column, row) inside one cell, per the Unicode braille layout.
const DOT = [
  [0x01, 0x02, 0x04, 0x40],
  [0x08, 0x10, 0x20, 0x80],
] as const;

/** A grid of cells: braille dots under, whole characters over; each cell has the color last drawn in it. */
class Cells {
  readonly dots: Uint8Array;
  readonly over: (string | undefined)[];
  readonly colors: (Rgb | undefined)[];
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.dots = new Uint8Array(width * height);
    this.over = new Array<string | undefined>(width * height).fill(undefined);
    this.colors = new Array<Rgb | undefined>(width * height).fill(undefined);
  }
  dot(x: number, y: number, color?: Rgb): void {
    const [cx, cy] = [Math.floor(x / 2), Math.floor(y / 4)];
    if (x < 0 || y < 0 || cx >= this.width || cy >= this.height) return;
    this.dots[cy * this.width + cx]! |= DOT[x % 2]![y % 4]!;
    if (color) this.colors[cy * this.width + cx] = color;
  }
  put(cx: number, cy: number, char: string, color?: Rgb): void {
    if (cx < 0 || cy < 0 || cx >= this.width || cy >= this.height) return;
    this.over[cy * this.width + cx] = char;
    this.colors[cy * this.width + cx] = color;
  }
  /** Bresenham between two dot positions. */
  segment(a: readonly [number, number], b: readonly [number, number], color?: Rgb): void {
    let [x, y] = a;
    const dx = Math.abs(b[0] - x);
    const dy = -Math.abs(b[1] - y);
    const sx = x < b[0] ? 1 : -1;
    const sy = y < b[1] ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.dot(x, y, color);
      if (x === b[0] && y === b[1]) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }
  text(cx: number, cy: number, s: string, color?: Rgb): void {
    Array.from(s).forEach((c, k) => this.put(cx + k, cy, c, color));
  }
  /** The rows as text, trailing blanks trimmed, with ANSI where `color`. */
  toString(color: boolean): string {
    const rows: string[] = [];
    for (let r = 0; r < this.height; r++) {
      let row = "";
      let open: string | undefined;
      for (let c = 0; c < this.width; c++) {
        const i = r * this.width + c;
        const char = this.over[i] ?? (this.dots[i] ? String.fromCharCode(BRAILLE + this.dots[i]!) : " ");
        const code = color && char !== " " && this.colors[i] ? sgr(this.colors[i]!) : undefined;
        if (code !== open) {
          row += open !== undefined ? "\x1b[0m" : "";
          row += code !== undefined ? `\x1b[${code}m` : "";
          open = code;
        }
        row += char;
      }
      if (open !== undefined) row += "\x1b[0m";
      rows.push(row.replace(/\s+$/, ""));
    }
    return rows.join("\n").replace(/^\n+|\n+$/g, "");
  }
}

// ── Braille: curves and points ───────────────────────────────────────────────────────────

/** Most dots a frame unit may take, so a small figure is not stretched across the terminal. */
const MAX_DOTS_PER_UNIT = 24;

function drawBraille(marks: readonly Mark[], width: number, height: number): Cells {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const { shape } of marks) {
    const points = shape.head === "Disk" || shape.head === "Text" ? [shape.center] : shape.points;
    for (const p of points) {
      xs.push(p[0]!);
      ys.push(p[1]!);
    }
  }
  if (xs.length === 0) return new Cells(0, 0);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  // Half a cell of room around the figure, so a point on the edge keeps its glyph.
  const room = 4;
  const scale = Math.min(
    MAX_DOTS_PER_UNIT,
    (width * 2 - 2 * room) / (x1 - x0 || 1),
    (height * 4 - 2 * room) / (y1 - y0 || 1),
  );
  const cols = Math.min(width, Math.ceil(((x1 - x0) * scale + 2 * room) / 2));
  const rows = Math.min(height, Math.ceil(((y1 - y0) * scale + 2 * room) / 4));
  const cells = new Cells(cols, rows);
  const toDot = (p: Point): [number, number] => [
    Math.round((p[0]! - x0) * scale + room),
    Math.round((y1 - p[1]!) * scale + room),
  ];
  const strokes = (shape: Extract<Shape, { points: readonly Point[] }>, color: Rgb | undefined): void => {
    const closed = shape.head === "Polygon";
    const n = shape.points.length;
    const breaks = shape.head === "Line" ? shape.breaks : [];
    for (let k = 1; k < (closed ? n + 1 : n); k++) {
      if (breaks.includes(k)) continue;
      cells.segment(toDot(shape.points[k - 1]!), toDot(shape.points[k % n]!), color);
    }
    if (n === 1) {
      const [x, y] = toDot(shape.points[0]!);
      cells.dot(x, y, color);
    }
  };
  // Lines and outlines first; points and text over them.
  for (const { shape, face, edge } of marks) {
    if (shape.head === "Line") strokes(shape, rgbOf(edge ?? face));
    else if (shape.head === "Polygon") strokes(shape, rgbOf(edge ?? face));
  }
  for (const { shape, face, edge } of marks) {
    if (shape.head === "Disk") {
      const [x, y] = toDot(shape.center);
      cells.put(Math.floor(x / 2), Math.floor(y / 4), "●", rgbOf(face ?? edge));
    } else if (shape.head === "Text") {
      const [x, y] = toDot(shape.center);
      cells.text(
        Math.floor(x / 2) - Math.floor((shape.text.length - 1) / 2),
        Math.floor(y / 4),
        shape.text,
        rgbOf(face ?? edge),
      );
    }
  }
  return cells;
}

// ── Box-drawing: figures of rectangles ───────────────────────────────────────────────────

/** Columns and rows a unit of the frame takes in a ruled figure: room for a one- or two-digit label. */
const RULE_COLS = 4;
const RULE_ROWS = 2;

export const [UP, DOWN, LEFT, RIGHT] = [1, 2, 4, 8];
export const JOINT: Readonly<Record<number, string>> = {
  [UP]: "│",
  [DOWN]: "│",
  [UP | DOWN]: "│",
  [LEFT]: "─",
  [RIGHT]: "─",
  [LEFT | RIGHT]: "─",
  [DOWN | RIGHT]: "┌",
  [DOWN | LEFT]: "┐",
  [UP | RIGHT]: "└",
  [UP | LEFT]: "┘",
  [UP | DOWN | RIGHT]: "├",
  [UP | DOWN | LEFT]: "┤",
  [LEFT | RIGHT | DOWN]: "┬",
  [LEFT | RIGHT | UP]: "┴",
  [UP | DOWN | LEFT | RIGHT]: "┼",
};

/** The corners of an axis-aligned rectangle given as four points, else undefined. */
function rectangleOf(points: readonly Point[]): [number, number, number, number] | undefined {
  if (points.length !== 4) return undefined;
  const xs = [...new Set(points.map((p) => p[0]!))];
  const ys = [...new Set(points.map((p) => p[1]!))];
  return xs.length === 2 && ys.length === 2
    ? [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    : undefined;
}

function drawRuled(marks: readonly Mark[]): Cells {
  const rects = marks.flatMap((m) =>
    m.shape.head === "Polygon" ? [{ box: rectangleOf(m.shape.points)!, mark: m }] : [],
  );
  const [x0, y1] = [Math.min(...rects.map((r) => r.box[0])), Math.max(...rects.map((r) => r.box[3]))];
  // The pitch of the grid: the least step between neighboring rectangles' near edges (a cell
  // is a little narrower than its pitch), else a rectangle's own size.
  const unit = (axis: 0 | 1): number => {
    const starts = [...new Set(rects.map((r) => r.box[2 * axis]!))].toSorted((a, b) => a - b);
    const steps = starts.slice(1).map((v, k) => v - starts[k]!);
    return Math.min(...(steps.length > 0 ? steps : rects.map((r) => r.box[2 * axis + 1]! - r.box[2 * axis]!)));
  };
  const [sx, sy] = [RULE_COLS / unit(0), RULE_ROWS / unit(1)];
  const col = (x: number): number => Math.round((x - x0) * sx);
  const row = (y: number): number => Math.round((y1 - y) * sy);
  const cols = Math.max(...rects.map((r) => col(r.box[1]))) + 1;
  const rows = Math.max(...rects.map((r) => row(r.box[2]))) + 1;
  const cells = new Cells(cols, rows);
  const masks = new Uint8Array(cols * rows);
  const paint = (c: number, r: number, mask: number, color: Rgb | undefined): void => {
    masks[r * cols + c]! |= mask;
    if (color) cells.colors[r * cols + c] = color;
  };
  for (const { box, mark } of rects) {
    const color = rgbOf(mark.edge ?? mark.face);
    const [c0, c1, r0, r1] = [col(box[0]), col(box[1]), row(box[3]), row(box[2])];
    for (let c = c0; c <= c1; c++)
      for (const r of [r0, r1]) paint(c, r, (c > c0 ? LEFT : 0) | (c < c1 ? RIGHT : 0), color);
    for (let r = r0; r <= r1; r++)
      for (const c of [c0, c1]) paint(c, r, (r > r0 ? UP : 0) | (r < r1 ? DOWN : 0), color);
  }
  masks.forEach((mask, i) => {
    if (mask) cells.over[i] = JOINT[mask];
  });
  for (const { shape, face, edge } of marks)
    if (shape.head === "Text") {
      const [c, r] = [col(shape.center[0]!), row(shape.center[1]!)];
      cells.text(c - Math.floor((shape.text.length - 1) / 2), r, shape.text, rgbOf(face ?? edge));
    }
  return cells;
}

/** Tiles of a pinned lattice: few enough that each outline keeps a few dots. */
const PINNED_TILES = 120;

/** A figure's `GraphicsBox` on character cells; the reason it can't be drawn, as text, otherwise. */
export function drawGraphicsBox(box: Box, options: CellOptions = {}): string {
  const [width, height] = [options.width ?? 60, options.height ?? 14];
  // A lattice holds a producer: pin it to the view the cells can resolve (a cell is 2 by 4 dots).
  const pinned = pinnedBox(box, { width: width * 2, height: height * 4, maxCells: PINNED_TILES });
  const marks = typeof pinned === "string" ? undefined : marksOf(pinned);
  if (marks === undefined) return typeof pinned === "string" ? pinned : "(not a drawing)";
  const shapes = marks.filter((m) => m.shape.head !== "Text");
  const ruled =
    shapes.length > 0 && shapes.every((m) => m.shape.head === "Polygon" && rectangleOf(m.shape.points) !== undefined);
  const cells = ruled ? drawRuled(marks) : drawBraille(marks, width, height);
  return cells.width === 0 ? "(nothing to draw)" : cells.toString(options.color ?? false);
}
