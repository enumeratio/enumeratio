// A diagram as a `GraphicsBox` (the wiki's Speculative-Box-Primitives, §3): a figure laid out in
// its own pixel frame, without axes. Vertices and rings are `DiskBox`es, edges `LineBox`es (an
// arrow is an `ArrowBox`), text an `InsetBox`, a square a `PolygonBox`; each is tagged with its
// role and styled by a `StyleBox`. `PlotRange` is the frame, `ImageSize` its size in px and
// `PlotLabel` the title above it. The graph plots and the torus square lower to this; `svg()`
// draws it and a terminal reads the same box.
//
// Layout code works in a y-down pixel frame, as a page does; the box is y-up, like every
// Wolfram `Graphics`, so `Sketch` flips on the way in.

import {
  arrow,
  type Box,
  type BoxNode,
  disk,
  graphics,
  inset,
  isNode,
  line,
  type Options,
  type OptionValue,
  optionsOfBox,
  polygon,
  row,
  style,
  tag,
} from "@enumeratio/boxes";
import type { Edge } from "./graphics-rules.ts";
import { plotItems } from "./plot-box.ts";
import { svg } from "./svg-draw.ts";
import type { DisplayList, GraphicsPrimitive, MarkItem } from "./tiles-canvas.ts";

export const INK = "var(--notatio-fg, currentColor)";
export const ACCENT = "var(--notatio-accent, var(--vp-c-brand-1, #d97706))";
export const RULE = "var(--notatio-border, var(--vp-c-divider, currentColor))";
export const GROUND = "var(--notatio-bg, var(--vp-c-bg, #ffffff))";

/** Arrowhead length in px, and the half-angle it opens to. */
const HEAD = 8;
const HEAD_TURN = 0.4;
const TITLE_SIZE = 12;
const TITLE_BASELINE = 14;

/** How a mark is stroked. */
export interface Stroke {
  readonly color: string;
  readonly width: number;
  readonly opacity?: number;
  readonly dashing?: readonly number[];
}

/** How a mark looks: the fill, its opacity and the outline. */
export interface Look {
  readonly fill?: string;
  readonly opacity?: number;
  readonly stroke?: Stroke;
}

/** How text looks: `size` px high, `anchor`ed at its position, optionally monospaced, faded or turned. */
export interface TextStyle {
  readonly size: number;
  readonly color: string;
  readonly anchor?: "start" | "middle" | "end";
  readonly mono?: boolean;
  readonly opacity?: number;
  /** Degrees counterclockwise from the horizontal, in the page's sense (a quarter turn reads upward). */
  readonly angle?: number;
}

type Point = readonly [number, number];

const pair = (p: Point): OptionValue => [p[0], p[1]];
const strokeOf = (s: Stroke): OptionValue => [[s.color, s.width, s.opacity ?? 1, [...(s.dashing ?? [])]]];

const lookOf = (look: Look): Options => ({
  ...(look.fill !== undefined && { FaceForm: look.fill }),
  ...(look.opacity !== undefined && { Opacity: look.opacity }),
  ...(look.stroke && { EdgeForm: strokeOf(look.stroke) }),
});

/** The unit vector a mark points along, `from` to `to`, or undefined if they coincide. */
function unit(from: Point, to: Point): Point | undefined {
  const d = Math.hypot(to[0] - from[0], to[1] - from[1]);
  return d === 0 ? undefined : [(to[0] - from[0]) / d, (to[1] - from[1]) / d];
}

/** The triangle that tips a path with an arrow: its point is the path's end. */
export function arrowhead(path: readonly (readonly number[])[]): number[][] | undefined {
  const [a, b] = [path.at(-2), path.at(-1)];
  const heading = a && b ? unit(a as Point, b as Point) : undefined;
  if (!b || !heading) return undefined;
  const angle = Math.atan2(heading[1], heading[0]);
  const wing = (turn: number): number[] => [
    b[0]! - HEAD * Math.cos(angle + turn),
    b[1]! - HEAD * Math.sin(angle + turn),
  ];
  return [[b[0]!, b[1]!], wing(HEAD_TURN), wing(-HEAD_TURN)];
}

/**
 * A figure under construction, in a `width` by `height` frame whose y runs down. Marks are listed
 * in drawing order; `box()` is the `GraphicsBox`.
 */
export class Sketch {
  readonly #items: Box[] = [];

  constructor(
    readonly width: number,
    readonly height: number,
    readonly options: { readonly label: string; readonly title?: string },
  ) {}

  #flip = (p: Point): Point => [p[0], this.height - p[1]];

  #add(prim: Box, role: string, look: Look): void {
    this.#items.push(style(tag(prim, role), lookOf(look)));
  }

  /** A disk of radius `r`, a ring when it has no fill. */
  disk(center: Point, r: number, look: Look, role = "Vertex"): void {
    this.#add(disk({ Center: pair(this.#flip(center)), Radius: r }), role, look);
  }

  /** A polyline through `points`. */
  line(points: readonly Point[], look: Look, role = "Edge"): void {
    this.#add(line({ Points: points.map((p) => pair(this.#flip(p))) }), role, look);
  }

  /** A polyline with an arrowhead at its last point. */
  arrow(points: readonly Point[], look: Look, role = "Edge"): void {
    this.#add(arrow({ Points: points.map((p) => pair(this.#flip(p))) }), role, look);
  }

  /** A closed polygon. */
  polygon(points: readonly Point[], look: Look, role = "Frame"): void {
    this.#add(polygon({ Points: points.map((p) => pair(this.#flip(p))) }), role, look);
  }

  /** `text` at `at`, on its baseline. */
  text(at: Point, text: string, look: TextStyle, role = "Label"): void {
    if (text === "") return;
    const turn = ((look.angle ?? 0) * Math.PI) / 180;
    this.#add(
      inset(text, {
        Center: pair(this.#flip(at)),
        Size: look.size,
        ...(look.anchor && { Alignment: look.anchor }),
        ...(look.mono && { FontFamily: "Courier" }),
        ...(look.opacity !== undefined && { Opacity: look.opacity }),
        ...(look.angle && { Direction: [Math.cos(turn), Math.sin(turn)] }),
      }),
      role,
      { fill: look.color },
    );
  }

  box(): Box {
    return graphics(row(this.#items), {
      ImageSize: [this.width, this.height],
      PlotRange: [
        [0, this.width],
        [0, this.height],
      ],
      Axes: false,
      ViewKind: "fixed",
      Label: this.options.label,
      ...(this.options.title && { PlotLabel: this.options.title }),
    });
  }
}

// ── Drawing ──────────────────────────────────────────────────────────────────────────────

export interface DiagramDrawing {
  /** The marks in a y-up pixel frame (`svg()` mirrors them back). */
  readonly list: DisplayList;
  readonly size: readonly [number, number];
  readonly label: string;
}

const numbers = (value: unknown): number[] | undefined =>
  Array.isArray(value) && value.every((v) => typeof v === "number") ? (value as number[]) : undefined;

const edgesOf = (value: unknown): Edge[] =>
  Array.isArray(value)
    ? value.flatMap((e) =>
        Array.isArray(e) && typeof e[0] === "string"
          ? [{ color: e[0], width: Number(e[1]), opacity: Number(e[2]), dashing: numbers(e[3]) ?? [] }]
          : [],
      )
    : [];

/**
 * Whether `box` is a diagram's `GraphicsBox`: a frame (`PlotRange`) of tagged marks, with no
 * scaled axes (a plot's) and no complex of addressed marks (a figure's).
 */
export function isDiagramBox(box: Box): box is BoxNode {
  if (!isNode(box) || box[0] !== "GraphicsBox") return false;
  const o = optionsOfBox(box);
  const content = box[1] as Box;
  return (
    o.PlotRange !== undefined &&
    o.ScalingFunctions === undefined &&
    !(isNode(content) && content[0] === "GraphicsComplexBox")
  );
}

/** A diagram box mapped to pixels: its marks in order, then the title. Pure; `svg()` writes it. */
export function drawDiagram(box: BoxNode): DiagramDrawing {
  const o = optionsOfBox(box);
  const [W, H] = (numbers(o.ImageSize) ?? [1, 1]) as [number, number];
  const marks: MarkItem[] = [];
  const push = (mark: GraphicsPrimitive, look: MarkItem["style"]): void => {
    marks.push({ address: [0, 0], at: [0, 0], mark, style: look, selected: false });
  };
  const points = (value: unknown): number[][] =>
    Array.isArray(value) ? value.flatMap((p) => (numbers(p) ? [numbers(p)!] : [])) : [];
  for (const { prim, look } of plotItems(box)) {
    const p = optionsOfBox(prim);
    const edges = edgesOf(look.EdgeForm);
    const color = typeof look.FaceForm === "string" ? look.FaceForm : undefined;
    const opacity = typeof look.Opacity === "number" ? look.Opacity : undefined;
    switch (prim[0]) {
      case "DiskBox":
        push(
          { head: "Disk", radius: Number(p.Radius), center: numbers(p.Center) ?? [0, 0] },
          { ...(color && { color }), ...(opacity !== undefined && { opacity }), edges },
        );
        break;
      case "LineBox":
        push({ head: "Line", points: points(p.Points) }, { edges });
        break;
      case "PolygonBox":
        push({ head: "Polygon", points: points(p.Points) }, { ...(color && { color }), edges });
        break;
      case "ArrowBox": {
        const path = points(p.Points);
        push({ head: "Line", points: path }, { edges });
        const head = arrowhead(path);
        if (head) push({ head: "Polygon", points: head }, { ...(color && { color }), edges: [] });
        break;
      }
      case "InsetBox": {
        const at = numbers(p.Center);
        const direction = numbers(p.Direction);
        if (at && typeof prim[1] === "string" && color)
          push(
            {
              head: "Text",
              text: prim[1],
              size: Number(p.Size),
              at,
              look: {
                anchor: (p.Alignment as "start" | "middle" | "end" | undefined) ?? "middle",
                ...(p.FontFamily === "Courier" && { mono: true }),
                ...(typeof p.Opacity === "number" && { opacity: p.Opacity }),
                ...(direction && { angle: (Math.atan2(direction[1]!, direction[0]!) * 180) / Math.PI }),
              },
            },
            { color, edges: [] },
          );
        break;
      }
      default:
    }
  }
  if (typeof o.PlotLabel === "string")
    push(
      {
        head: "Text",
        text: o.PlotLabel,
        size: TITLE_SIZE,
        at: [W / 2, H - TITLE_BASELINE],
        look: { anchor: "middle" },
      },
      { color: INK, edges: [] },
    );
  return {
    list: { kind: "marks", view: "fixed", marks, links: [], complete: true },
    size: [W, H],
    label: typeof o.Label === "string" ? o.Label : "diagram",
  };
}

/** A diagram box as SVG. */
export function renderDiagram(box: BoxNode): string {
  const d = drawDiagram(box);
  const [W, H] = d.size;
  return svg(d.list, W, H, { center: [W / 2, H / 2], extent: H / 2 }, { rounded: true, label: d.label });
}
