// What a `Show` says, read from its expression once its parameters are bound: the layer it tiles,
// the rules that style it, the frame's furniture (grid, axes, locators). Engine-free and DOM-free,
// so the lowering to a `GraphicsBox` (`show-box.ts`) and the web element read it the same way.

import { GRAPHICS_OPTIONS } from "@enumeratio/formats/graphics-options";
import { FIGURE_DEFAULTS, FIGURE_HEADS, type FigureHead } from "./figure-frames.ts";
import { argsOf, headOf, type Json } from "./frame-json.ts";
import {
  type BoundaryRule,
  boundaryRuleOf,
  type ColorMixing,
  type ColorRule,
  colorMixingOf,
  colorRuleOf,
  edgeOf,
  rulesOf,
  splitOptions,
} from "./graphics-rules.ts";
import type { Vec2 } from "./lattice.ts";
import type { LineStyle } from "./tiles-canvas.ts";

/** The options `head` declares, as a set. */
export const declared = (head: string): ReadonlySet<string> => new Set(GRAPHICS_OPTIONS[head] ?? []);
export const stringOf = (json: Json): string | undefined =>
  typeof json === "string" ? json.replace(/^'([\s\S]*)'$/, "$1") : (json as { str?: string } | undefined)?.str;
export const numberOf = (json: Json, fallback: number): number => {
  if (headOf(json) === "Negate") return -numberOf(argsOf(json)[0], -fallback);
  const n = typeof json === "number" ? json : Number(stringOf(json));
  return Number.isFinite(n) ? n : fallback;
};

/** `json` with each parameter's wildcard (`_d`) replaced by its value, wherever it stands. */
export function bind(json: Json, params: ReadonlyMap<string, Json>): Json {
  if (typeof json === "string" && json.startsWith("_") && params.has(json.slice(1))) return params.get(json.slice(1));
  return Array.isArray(json) ? json.map((node) => bind(node, params)) : json;
}

/** The layer a `Show` tiles. */
export interface ShowTiles {
  readonly head: "LatticeTiles" | "ArrayPlot" | FigureHead;
  readonly data: Json;
  /** `PolytopeFaces` layers share a frame: all of them, whole, in order. */
  readonly layers?: readonly Json[];
  /** `Embedding -> "Logarithmic"`: a real field's elements at (log|σ₁|, log|σ₂|). */
  readonly embedding?: string;
}

/** What a `Show` says, read once its parameters are bound. */
export interface ShowSpec {
  /** Draggable points, Wolfram's `Locator`: each one a variable's point, or its list of points. */
  readonly locators: readonly LocatorSpec[];
  /** The tiled layer: `LatticeTiles(ring)`, `ArrayPlot(table)` or a figure frame (`StrandDiagram`, `CellDiagram`, …), its data. */
  readonly tiles?: ShowTiles;
  readonly colorRules: readonly ColorRule[];
  readonly boundaryRules: readonly BoundaryRule[];
  readonly colorMixing: ColorMixing;
  /** The rules as written (MathJSON), which a drawer that restyles reads; the layer's own when left out. */
  readonly written: { readonly colors: Json; readonly edges: Json };
  /** Rules whose test or style didn't read. */
  readonly unread: number;
  /** The layer's own rules stand in for ones the author left out; the legend doesn't list them. */
  readonly defaulted: { readonly colors: boolean; readonly edges: boolean };
  /** `auto`: `GridLines -> Automatic`, whose step is the layer's own grid when it has one. */
  readonly grid?: { readonly step: readonly [number, number]; readonly auto: boolean; readonly style: LineStyle };
  readonly axes?: { readonly style: LineStyle; readonly ticks: boolean };
  readonly aspect: "Uniform" | "True";
}

/** A `Locator(_v)`: the points it puts where `_v` says, and how they move. */
export interface LocatorSpec {
  readonly points: readonly Vec2[];
  /** The variable holds a list of points, not one. */
  readonly list: boolean;
  /** Wolfram's `LocatorAutoCreate`: ⌥-click adds a point, or takes one away. */
  readonly autoCreate: boolean;
  readonly label: string;
}

/** A point `(a, b)` in the frame's coordinates. */
const pointOf = (json: Json): Vec2 | undefined =>
  headOf(json) === "Tuple" && argsOf(json).length === 2
    ? [numberOf(argsOf(json)[0], Number.NaN), numberOf(argsOf(json)[1], Number.NaN)]
    : undefined;
const pointsOf = (json: Json): Vec2[] =>
  (headOf(json) === "List" ? argsOf(json) : [json]).flatMap((p) => {
    const v = pointOf(p);
    return v && v.every(Number.isFinite) ? [v] : [];
  });
export const tuple = ([a, b]: Vec2): Json => ["Tuple", a, b];

/** A wildcard's variable name: `_b` names `b`. */
export const wildcardOf = (json: Json): string | undefined =>
  typeof json === "string" && /^_[A-Za-z]\w*$/.test(json) ? json.slice(1) : undefined;

/** `RadixExpansions`' options: the example it follows, and whether it keeps to the lattice. */
export const RADIX_OPTIONS: ReadonlySet<string> = new Set(["Example", "OnLattice"]);

/** Rings `RadixExpansions` draws on, and their systems. */
export const RADIX_SYSTEMS: Readonly<Record<string, "i" | "ω">> = { GaussianIntegers: "i", EisensteinIntegers: "ω" };

/** `RadixExpansions(ring, base, digits, places)`, bound, as the layer's settings. */
export function radixSettingsOf(data: Json) {
  const { positional, options } = splitOptions(data, RADIX_OPTIONS);
  const [ring, base, digits, places] = positional;
  const system = typeof ring === "string" ? RADIX_SYSTEMS[ring] : undefined;
  const b = pointOf(base);
  if (!system || !b) return undefined;
  const onLattice = options.get("OnLattice") !== "False";
  return { system, base: b, digits: pointsOf(digits), places: numberOf(places, 8), onLattice };
}

/** Grid lines every this many units of the frame, for `GridLines -> Automatic`. */
export const GRID_STEP = 10;

/** A line style from an edge directive (`Directive(White, AbsoluteThickness(1), Opacity(0.2))`). */
const lineStyleOf = (json: Json, fallback: LineStyle): LineStyle => {
  const edge = json === undefined ? undefined : edgeOf(json);
  return edge ? { color: edge.color, width: edge.width, opacity: edge.opacity } : fallback;
};

export function specOf(json: Json): ShowSpec {
  const { positional, options } = splitOptions(json, declared("Show"));
  let tiles: ShowTiles | undefined;
  let colorRules: ColorRule[] = [];
  let boundaryRules: BoundaryRule[] = [];
  let colorMixing: ColorMixing = "First";
  let written: ShowSpec["written"] = { colors: undefined, edges: undefined };
  let unread = 0;
  let defaulted = { colors: false, edges: false };
  const locators: LocatorSpec[] = [];
  for (const layer of positional) {
    const head = headOf(layer);
    if (head === "Locator") {
      const {
        positional: [at],
        options: o,
      } = splitOptions(layer, declared("Locator"));
      locators.push({
        points: pointsOf(at),
        list: headOf(at) === "List",
        autoCreate: o.get("LocatorAutoCreate") === "True",
        label: stringOf(o.get("Appearance")) ?? "",
      });
      continue;
    }
    const figure = FIGURE_HEADS.find((h) => h === head);
    if (head === undefined || (head !== "LatticeTiles" && head !== "ArrayPlot" && !figure)) continue;
    const split = splitOptions(layer, declared(head));
    const embedding = stringOf(split.options.get("Embedding"));
    const sharing = figure === "PolytopeFaces" && tiles?.head === "PolytopeFaces";
    const layers = figure === "PolytopeFaces" ? [...(tiles?.layers ?? []), layer] : undefined;
    tiles = {
      head: head as ShowTiles["head"],
      data: split.positional[0],
      ...(layers ? { layers } : {}),
      ...(embedding ? { embedding } : {}),
    };
    // Layers sharing a frame share its rules: the first to give any.
    if (sharing && !split.options.has("ColorRules") && !split.options.has("BoundaryStyle")) continue;
    // A figure frame has no look without rules: its own stand in for any the author leaves out.
    const own = figure ? FIGURE_DEFAULTS[figure] : undefined;
    const [colorsGiven, edgesGiven] = [split.options.has("ColorRules"), split.options.has("BoundaryStyle")];
    defaulted = { colors: !!own && !colorsGiven, edges: !!own && !edgesGiven };
    written = {
      colors: own && !colorsGiven ? own.colors : split.options.get("ColorRules"),
      edges: own && !edgesGiven ? own.edges : split.options.get("BoundaryStyle"),
    };
    const colors = rulesOf(written.colors, colorRuleOf);
    const edges = rulesOf(written.edges, boundaryRuleOf);
    colorRules = colors.rules;
    boundaryRules = edges.rules;
    colorMixing = colorMixingOf(split.options.get("ColorMixing"));
    unread = colors.unread + edges.unread;
  }
  // `GridLines -> [x, y]`: a line every x units along the frame's first axis and every y along
  // its second (a lattice frame's are 1 and ω), `None` or 0 for none; `Automatic` every GRID_STEP.
  const gridLines = options.get("GridLines");
  const specs =
    headOf(gridLines) === "List" ? argsOf(gridLines) : gridLines === "Automatic" ? [gridLines, gridLines] : [];
  const step = specs.slice(0, 2).map((g) => (g === "Automatic" ? GRID_STEP : numberOf(g, 0))) as [number, number];
  const grid = step.some((k) => k > 0)
    ? {
        step,
        auto: gridLines === "Automatic",
        style: lineStyleOf(options.get("GridLinesStyle"), { color: "#ffffff", width: 1, opacity: 0.16 }),
      }
    : undefined;
  const axes =
    options.get("Axes") === "True"
      ? {
          style: lineStyleOf(options.get("AxesStyle"), { color: "", width: 1.5, opacity: 0.55 }),
          ticks: options.get("Ticks") !== "None",
        }
      : undefined;
  return {
    locators,
    ...(tiles ? { tiles } : {}),
    colorRules,
    boundaryRules,
    colorMixing,
    written,
    unread,
    defaulted,
    ...(grid ? { grid } : {}),
    ...(axes ? { axes } : {}),
    aspect: options.get("AspectRatio") === "Automatic" ? "True" : "Uniform",
  };
}
