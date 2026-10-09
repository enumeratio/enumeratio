import { PLOT_HEADS } from "./plot-lowering.ts";
import { type MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { CONTROL_NOTATION_HEADS, LAYOUT_HEADS, LAYOUT_OPTIONS, makeBoxes, slot } from "@enumeratio/boxes";
import { optionsOf } from "@enumeratio/formats";
import { serializeExpression } from "@enumeratio/formats/expression";
import { FRAME_HEIGHT, figureLayerOf, VALUE_FRAMES } from "./figure-frames.ts";
import { renderBox } from "./box-render.ts";
import { plainJson } from "./graphics-rules.ts";
import { GRADIENTS } from "./palettes.ts";
import type { ScaleName } from "./scales.ts";
import {
  clean,
  intervalAttributes,
  listedAttributes,
  locatorAttributes,
  planarAttributes,
  rangedAttributes,
  simpleAttributes,
  variable,
} from "./control-box.ts";
import { epsil, headOf, numOf, opsOf, optionAttribute, strOf, symOf, tupleOf } from "./mathjson.ts";

export { headOf, numOf, opsOf, optionAttribute, strOf, symOf, tupleOf, variable };

// A symbol and its component are the same thing seen from two ends
// (https://github.com/enumeratio/enumeratio/wiki/Components-and-Symbols). This is the map between them: for every head that
// draws, which tag draws it and where its arguments land as attributes. It is pure --
// no DOM, no Lit -- so it can be read by the docs build to emit the Vue wrappers, by
// `<notatio-out>` to render an evaluated `Plot(…)`, and by anything else that holds an
// expression and wants a picture.
//
// The tag is the naming rule run backwards: kebab-case the symbol, put `notatio-` in
// front. A family component (`notatio-chart`, `notatio-graph-plot`)
// draws several symbols, distinguished by an attribute; the family head (`Chart`) leaves
// that attribute unset and lets the component choose.

/**
 * What to render: a tag, its attributes, and any children (a `Manipulate` body, a
 * `Row`'s entries) -- or, for a string in a layout, a run of text.
 */
export interface Rendering {
  readonly tag: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly children?: readonly Rendering[];
  readonly text?: string;
}

/** One visual symbol: the tag it renders as, and the attributes its arguments become. */
export interface VisualSymbol {
  readonly head: string;
  readonly tag: string;
  /** Attributes fixed by the symbol itself -- a family member's `type`. */
  readonly fixed?: Readonly<Record<string, string>>;
  /** The argument-to-attribute map, over the head's POSITIONAL operands. */
  readonly attributes: (ops: readonly MathJsonExpression[]) => Record<string, string>;
  /** Operands that render as children rather than attributes (a `Manipulate` body). */
  readonly children?: (ops: readonly MathJsonExpression[]) => MathJsonExpression[];
  /**
   * The element's loose text is prose around its controls, with `$…$` islands as the only
   * expressions in it (a `DynamicModule`, a `Manipulate`); otherwise bare atoms in it are
   * argument leaves.
   */
  readonly prose?: true;
  /**
   * Where a Wolfram option lands when it is not simply the kebab-cased attribute:
   * `PlotLabel` is the plot's `label`, `AxesLabel` is two attributes. A string names
   * the attribute; a function returns the attributes.
   */
  /**
   * The element reads its options from its own expression, as written (`Show`): they stay in what
   * `attributes` is given rather than lowering to attributes, all but `Variables`, which declares
   * a scope and so must be an attribute the page's scopes can see.
   */
  readonly holdsOptions?: true;
  /** Whether the symbol draws these operands; where it does not, the head typesets as it did. */
  readonly when?: (ops: readonly MathJsonExpression[]) => boolean;
  readonly options?: Readonly<Record<string, string | ((value: MathJsonExpression) => Record<string, string>)>>;
  /** For a control: the shape of what it binds, which is how `reduce` reads it statically. */
  readonly control?: ControlKind;
}

/**
 * What a control's arguments declare: a range `(min, max, step)`, a list of entries, a
 * point in a box, an interval in a range, a point on a plot, or a bare value.
 */
export type ControlKind = "ranged" | "listed" | "planar" | "interval" | "locator" | "simple";

type Json = MathJsonExpression;

/**
 * A complex literal as `[re, im]`: a number, `Complex(a, b)`, or the `a + b i` /
 * `b i` a parse leaves before the engine folds it -- or undefined.
 */
function complexOf(node: Json | undefined): [number, number] | undefined {
  if (node === undefined) return undefined;
  const n = numOf(node);
  if (n !== undefined) return [n, 0];
  // `i` is the symbol before the engine canonicalises it, `ImaginaryUnit` after.
  const sym = symOf(node);
  if (sym === "ImaginaryUnit" || sym === "i") return [0, 1];
  const head = headOf(node);
  const ops = opsOf(node);
  if (head === "Complex" && ops.length === 2) {
    const re = numOf(ops[0]);
    const im = numOf(ops[1]);
    return re !== undefined && im !== undefined ? [re, im] : undefined;
  }
  if (head === "Negate" && ops.length === 1) {
    const inner = complexOf(ops[0]);
    return inner && [-inner[0], -inner[1]];
  }
  if (head === "Multiply" && ops.length === 2) {
    const [a, b] = [complexOf(ops[0]), complexOf(ops[1])];
    return a && b ? [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]] : undefined;
  }
  if (head === "Add" && ops.length >= 2) {
    const parts = ops.map(complexOf);
    if (parts.some((p) => p === undefined)) return undefined;
    return (parts as [number, number][]).reduce((s, p) => [s[0] + p[0], s[1] + p[1]], [0, 0]);
  }
  if (head === "Subtract" && ops.length === 2) {
    const [a, b] = [complexOf(ops[0]), complexOf(ops[1])];
    return a && b ? [a[0] - b[0], a[1] - b[1]] : undefined;
  }
  return undefined;
}

/** A MathJSON dictionary literal (`{dict: {…}}`, compute-engine's own associative form). */
const dictOf = (node: unknown): Readonly<Record<string, Json>> | undefined => {
  const dict = (node as { dict?: unknown })?.dict;
  return dict !== null && typeof dict === "object" ? (dict as Record<string, Json>) : undefined;
};

/**
 * MathJSON data -- lists, tuples, dictionaries, numbers, strings -- as the plain JSON a
 * `data` attribute takes. A dictionary becomes a plain object, recursively, for a component
 * that takes a tree or a `{nodes?, edges}` shape rather than a flat/nested list
 * (`GraphPlot`'s `data`).
 */
export function toJsonData(node: Json): unknown {
  const n = numOf(node);
  if (n !== undefined) return n;
  const s = strOf(node);
  if (s !== undefined) return s;
  if (headOf(node) === "List" || headOf(node) === "Tuple") return opsOf(node).map(toJsonData);
  const dict = dictOf(node);
  if (dict !== undefined) return Object.fromEntries(Object.entries(dict).map(([k, v]) => [k, toJsonData(v)]));
  const sym = symOf(node);
  if (sym === "True") return true;
  if (sym === "False") return false;
  return sym ?? epsil(node);
}

const json = (node: Json): string => JSON.stringify(toJsonData(node));

/** A Wolfram iterator `(x, a, b)`: the variable and its range, or undefined. */
function iterator(node: Json | undefined): { variable?: string; range?: string } {
  const parts = tupleOf(node);
  if (parts === undefined) return {};
  const [first, lo, hi] = parts;
  const variable = symOf(first);
  const range = lo !== undefined && hi !== undefined ? `${epsil(lo)},${epsil(hi)}` : undefined;
  return { variable, range };
}

/** Attributes for a function of one variable over an iterator. */
function oneVariable(
  ops: readonly Json[],
  names: { value: string; variable: string; range: string },
): Record<string, string> {
  const out: Record<string, string> = {};
  if (ops[0] !== undefined) out[names.value] = epsil(ops[0]);
  const { variable, range } = iterator(ops[1]);
  if (variable) out[names.variable] = variable;
  if (range) out[names.range] = range;
  return out;
}

/** Attributes for a function of two variables over two iterators. */
function twoVariables(
  ops: readonly Json[],
  names: { value: string; x: string; y: string; xrange: string; yrange: string },
): Record<string, string> {
  const out: Record<string, string> = {};
  if (ops[0] !== undefined) out[names.value] = epsil(ops[0]);
  const x = iterator(ops[1]);
  const y = iterator(ops[2]);
  if (x.variable) out[names.x] = x.variable;
  if (x.range) out[names.xrange] = x.range;
  if (y.variable) out[names.y] = y.variable;
  if (y.range) out[names.yrange] = y.range;
  return out;
}

const dataOnly = (ops: readonly Json[]): Record<string, string> => (ops[0] === undefined ? {} : { data: json(ops[0]) });

/** A family member: the family tag with the member's attribute fixed. */
const chart = (head: string, type: string, options?: VisualSymbol["options"]): VisualSymbol => ({
  head,
  tag: head === "ListPlot" || head === "ListLinePlot" ? "graphics-box" : "notatio-chart",
  fixed: { type },
  attributes: dataOnly,
  ...(options && { options }),
});

const graph = (head: string, type: string): VisualSymbol => ({
  head,
  tag: "notatio-graph-plot",
  fixed: { type },
  attributes: dataOnly,
});

/** `name` -> `_name` throughout, so a Manipulate body reads its parameters as slots. */
function slotted(node: Json, names: ReadonlySet<string>): Json {
  const sym = symOf(node);
  if (sym !== undefined && names.has(sym)) {
    return typeof node === "string" ? `_${sym}` : ({ ...(node as object), sym: `_${sym}` } as Json);
  }
  if (Array.isArray(node)) return node.map((n) => slotted(n as Json, names)) as unknown as Json;
  const fn = (node as { fn?: unknown[] })?.fn;
  if (Array.isArray(fn)) {
    return { ...(node as object), fn: fn.map((n) => slotted(n as Json, names)) } as Json;
  }
  return node;
}

/** `(a, 0, 5)` / `(a, 0, 5, 0.5)` / `((a, 2), 0, 5)` as one `params` tuple, `{a, 0, 5}`. */
function controlOf(node: Json): string | undefined {
  const parts = tupleOf(node)?.map((p) => {
    const inner = tupleOf(p);
    return inner === undefined ? epsil(p) : `{${inner.map(epsil).join(", ")}}`;
  });
  return parts !== undefined && parts.length >= 2 ? `{${parts.join(", ")}}` : undefined;
}

/** The parameter a control tuple binds. */
function controlName(node: Json): string | undefined {
  const first = tupleOf(node)?.[0];
  const inner = tupleOf(first);
  return symOf(inner === undefined ? first : inner[0]);
}

/**
 * `XLabel -> "x"` / `YLabel -> "y"`: the axis captions the 2-D field plots (`ContourPlot`,
 * `DensityPlot`, `VectorPlot`/`StreamPlot`) take. `Plot` names the same idea `AxesLabel`,
 * one tuple for both axes (see its own option below) -- these are plain aliases instead,
 * since `optionAttribute` can't split `XLabel` into `x-label` on its own (no lowercase
 * letter precedes the second word's capital for it to hyphenate at).
 */
const AXES_LABEL_OPTIONS = { XLabel: "x-label", YLabel: "y-label" };

/**
 * `ColorFunction -> "Viridis"` (or `ColorData("Viridis")`): the gradient the color of a
 * continuous value is drawn from, as the component's `gradient`. Only a name that is one
 * of our own gradients (`GRADIENTS`, any case) lowers; Wolfram's other schemes ("Rainbow",
 * "TemperatureMap", …) have no exact counterpart here, and are left out rather than
 * approximated, as is anything that is not a name (a pure function, `Automatic`).
 */
const gradientName = (value: Json): string | undefined => {
  const named = headOf(value) === "ColorData" ? opsOf(value)[0] : value;
  const wanted = (strOf(named) ?? symOf(named))?.toLowerCase();
  return GRADIENTS.find((g) => g.name === wanted)?.name;
};

const colorFunction = (value: Json): Record<string, string> => {
  const gradient = gradientName(value);
  return gradient === undefined ? {} : { gradient };
};

/**
 * `Plot`'s `ColorFunction`: `"x"` / `"y"` colors the curve by that coordinate (`color-by`),
 * and a gradient name colors it by x -- Wolfram's own default -- along that gradient.
 */
const plotColorFunction = (value: Json): Record<string, string> => {
  const axis = (strOf(value) ?? symOf(value))?.toLowerCase();
  if (axis === "x" || axis === "y") return { "color-by": axis };
  const gradient = gradientName(value);
  return gradient === undefined ? {} : { "color-by": "x", gradient };
};

/** The 2-D field plots' options: the axis captions, and the gradient their values are drawn from. */
const FIELD_OPTIONS = { ...AXES_LABEL_OPTIONS, ColorFunction: colorFunction };

/**
 * A Wolfram scaling-function name (`"Log"`, `"Log10"`, `"Log2"`, `"Sqrt"`, `"Linear"`,
 * `"None"`) as our own lowercase `ScaleName` -- `scales.ts`'s vocabulary is already just
 * the lowercased Wolfram spelling, `None` aside (Wolfram's way of saying no scaling).
 */
function scalingFunctionName(value: Json): ScaleName | undefined {
  const name = (strOf(value) ?? symOf(value))?.toLowerCase();
  if (name === "none") return "linear";
  return name === "linear" || name === "log" || name === "log10" || name === "log2" || name === "sqrt"
    ? name
    : undefined;
}

/**
 * `ScalingFunctions -> "Log"` (one function, the y axis -- how `LogPlot` is really just
 * `Plot` with this option, Wolfram's own idiom) or `-> ("Log", "Log")` (a pair, x then y).
 */
function scalingFunctionsOption(value: Json): Record<string, string> {
  const pair = tupleOf(value);
  const out: Record<string, string> = {};
  if (pair !== undefined) {
    const x = scalingFunctionName(pair[0]);
    const y = scalingFunctionName(pair[1]);
    if (x) out["x-scale"] = x;
    if (y) out["y-scale"] = y;
    return out;
  }
  const y = scalingFunctionName(value);
  if (y) out["y-scale"] = y;
  return out;
}

/**
 * The 2-D plots that lower to `<graphics-box>`: the element reads the expression it holds (`value`,
 * as `Show` does) and takes these rows' attributes from it, so each option keeps the name its
 * sampling code was written in. They are settings, not tags: the tag is `graphics-box`.
 */
export const PLOT_SETTINGS: readonly VisualSymbol[] = [
  {
    head: "Plot",
    tag: "graphics-box",
    attributes: (ops) => oneVariable(ops, { value: "value", variable: "var", range: "domain" }),
    options: {
      PlotLabel: "label",
      GridLines: "grid",
      PlotLegends: "legend",
      // `Filling -> True` / `ColorFunction -> "y"`: genuine Wolfram `Plot` options with
      // no kebab-cased match on the component's own attribute names (`fill`, `color-by`).
      Filling: "fill",
      ColorFunction: plotColorFunction,
      // `PlotPoints -> 240`: Wolfram's name for the initial sample count before adaptive
      // refinement -- the component calls the same thing `samples`.
      PlotPoints: "samples",
      // `AxesLabel -> ("x", "y")`, or one label for the x axis.
      AxesLabel: (value) => {
        const parts = tupleOf(value) ?? [value];
        const out: Record<string, string> = {};
        if (parts[0] !== undefined) out["x-label"] = strOf(parts[0]) ?? epsil(parts[0]);
        if (parts[1] !== undefined) out["y-label"] = strOf(parts[1]) ?? epsil(parts[1]);
        return out;
      },
      // A range is `(a, b)` for y, or `((x0, x1), (y0, y1))`; the component takes the y pair.
      PlotRange: (value): Record<string, string> => {
        const parts = tupleOf(value);
        if (parts === undefined) return {};
        const y = tupleOf(parts[1]) ?? (parts.length === 2 && tupleOf(parts[0]) === undefined ? parts : undefined);
        return y === undefined ? {} : { "plot-range": y.map(clean).join(",") };
      },
      ScalingFunctions: scalingFunctionsOption,
    },
  },
  {
    // `ParametricPlot({fx, fy}, (t, tmin, tmax))`: Wolfram's own separate head for a
    // parametric curve -- reuses `Plot`'s tag with `parametric` fixed on.
    head: "ParametricPlot",
    tag: "graphics-box",
    fixed: { parametric: "true" },
    attributes: (ops) => oneVariable(ops, { value: "value", variable: "var", range: "domain" }),
    options: { PlotPoints: "samples" },
  },
  {
    head: "PolarPlot",
    tag: "graphics-box",
    attributes: (ops) => oneVariable(ops, { value: "expr", variable: "tvar", range: "trange" }),
  },
  {
    // `ListPolarPlot(points)`: explicit `(theta, r)` pairs, or bare radii spread evenly --
    // see `ListContourPlot`.
    head: "ListPolarPlot",
    tag: "graphics-box",
    attributes: dataOnly,
  },
  chart("ListPlot", "list"),
  chart("ListLinePlot", "listline"),
  {
    head: "VectorPlot",
    tag: "graphics-box",
    attributes: (ops) => vectorField(ops),
    options: FIELD_OPTIONS,
  },
  {
    // `StreamPlot` reuses `VectorPlot`'s field and options, with streamlines for arrows.
    head: "StreamPlot",
    tag: "graphics-box",
    fixed: { type: "stream" },
    attributes: (ops) => vectorField(ops),
    options: FIELD_OPTIONS,
  },
];

const SETTINGS_BY_HEAD = new Map(PLOT_SETTINGS.map((p) => [p.head, p]));

/** A plot head's settings: the attributes its sampling reads, from the expression as written. */
export function plotSettingsOf(expr: Json): Record<string, string> | undefined {
  const head = headOf(expr);
  const symbol = head === undefined ? undefined : SETTINGS_BY_HEAD.get(head);
  if (symbol === undefined) return undefined;
  const { ops, options } = optionsOf(expr);
  return { ...symbol.fixed, ...symbol.attributes(ops), ...lowerOptions(symbol, options).attributes };
}

/** A plot head as a visual symbol: the whole expression, options and all, in the element's `value`. */
const plotSymbol = (head: string): VisualSymbol => ({
  head,
  tag: "graphics-box",
  holdsOptions: true,
  attributes: (ops) => ({ value: epsil([head, ...ops] as Json) }),
});

export const VISUAL_SYMBOLS: readonly VisualSymbol[] = [
  ...PLOT_HEADS.map(plotSymbol),
  {
    head: "Plot3D",
    tag: "notatio-plot-3d",
    attributes: (ops) =>
      twoVariables(ops, {
        value: "value",
        x: "xvar",
        y: "yvar",
        xrange: "x-domain",
        yrange: "y-domain",
      }),
    // `PlotLabel -> "…"`: same idea as `Plot`'s, but this component's caption attribute
    // is `label`, not the two-word kebab `optionAttribute` would default to.
    options: { PlotLabel: "label", ColorFunction: colorFunction },
  },
  {
    head: "ContourPlot",
    tag: "notatio-contour-plot",
    attributes: (ops) =>
      twoVariables(ops, {
        value: "expr",
        x: "xvar",
        y: "yvar",
        xrange: "xrange",
        yrange: "yrange",
      }),
    options: FIELD_OPTIONS,
  },
  {
    // `ListContourPlot(grid)`: a pre-sampled grid contoured directly, no expression or
    // iterators -- the same `data` a `ListPlot3D` takes.
    head: "ListContourPlot",
    tag: "notatio-contour-plot",
    attributes: dataOnly,
    options: { ColorFunction: colorFunction },
  },
  {
    head: "DensityPlot",
    tag: "notatio-density-plot",
    attributes: (ops) =>
      twoVariables(ops, {
        value: "expr",
        x: "xvar",
        y: "yvar",
        xrange: "xrange",
        yrange: "yrange",
      }),
    options: FIELD_OPTIONS,
  },
  {
    // `ListDensityPlot(grid)`: a pre-sampled grid shaded directly -- see `ListContourPlot`.
    head: "ListDensityPlot",
    tag: "notatio-density-plot",
    attributes: dataOnly,
    options: { ColorFunction: colorFunction },
  },
  {
    // `Show(layer, …, options)`: the layers stay one expression, which the element reads; its
    // options lower to attributes (`Caption` to `caption`) like any plot's.
    head: "Show",
    tag: "graphics-box",
    holdsOptions: true,
    // The height it will take, so the page lays out before the element is defined.
    attributes: (ops) => ({
      value: epsil(["Show", ...ops] as Json),
      style: `display:block;min-height:${showHeight(ops)}px`,
    }),
  },
  // A polytope displays as its faces under a camera, as Wolfram's `Polyhedron` displays as
  // `Graphics3D`: `Permutahedron(4)` is `Show(PolytopeFaces(Permutahedron(4)))`.
  ...["Permutahedron", "Simplex", "CrossPolytope", "Hypercube", "Associahedron"].map((head): VisualSymbol => ({
    head,
    tag: "graphics-box",
    attributes: (ops) => ({
      value: epsil([
        "Show",
        ["PolytopeFaces", [head, ...ops]],
        ["KeyValuePair", "Selection", ["List"]],
        ["KeyValuePair", "SphericalRegion", "True"],
        ["KeyValuePair", "ImageSize", ["List", "Automatic", 320]],
      ] as Json),
      style: "display:block;min-height:320px",
    }),
  })),
  // A braid displays as its strand diagram, a level per generator: `Braid(3, [1, -2])` is
  // `Show(StrandDiagram(Braid(3, [1, -2])))`, its strands picked by a click.
  {
    head: "Braid",
    tag: "graphics-box",
    attributes: (ops) => {
      const generators = headOf(ops[1]) === "List" ? opsOf(ops[1]).length : 0;
      const height = Math.min(480, Math.max(160, 60 + 32 * generators));
      return {
        value: epsil([
          "Show",
          ["StrandDiagram", ["Braid", ...ops]],
          ["KeyValuePair", "Selection", ["List"]],
          ["KeyValuePair", "ImageSize", ["List", "Automatic", height]],
        ] as Json),
        style: `display:block;min-height:${height}px`,
      };
    },
  },
  // A combinatorial value draws as the `Show` of its frame layer, with the frame's default rules:
  // `Permutation([3, 1, 2])` is `Show(StrandDiagram(Permutation([3, 1, 2])))`.
  ...Object.entries(VALUE_FRAMES).map(([head, frame]): VisualSymbol => ({
    head,
    tag: "graphics-box",
    when: (ops) => typeof figureLayerOf(frame, plainJson([head, ...ops])) !== "string",
    attributes: (ops) => ({
      value: epsil([
        "Show",
        [frame, [head, ...ops]],
        ["KeyValuePair", "ImageSize", ["List", "Automatic", FRAME_HEIGHT[frame]]],
      ] as Json),
      style: `display:block;min-height:${FRAME_HEIGHT[frame]}px`,
    }),
  })),
  {
    head: "ComplexPlot",
    tag: "notatio-complex-plot",
    attributes: (ops) => {
      const out: Record<string, string> = {};
      if (ops[0] !== undefined) out.value = epsil(ops[0]);
      const variable = symOf(ops[1]) ?? iterator(ops[1]).variable;
      if (variable) out.var = variable;
      return out;
    },
    options: { ColorFunction: colorFunction },
  },
  {
    // `ComplexPlot3D(f, (z, a + b i, c + d i))`: the iterator's corners are complex, and
    // the component takes the rectangle they span as `re0,re1,im0,im1`.
    head: "ComplexPlot3D",
    tag: "notatio-complex-plot-3d",
    attributes: (ops) => {
      const out: Record<string, string> = {};
      if (ops[0] !== undefined) out.value = epsil(ops[0]);
      const parts = tupleOf(ops[1]);
      const variable = symOf(ops[1]) ?? symOf(parts?.[0]);
      if (variable) out.var = variable;
      const lo = complexOf(parts?.[1]);
      const hi = complexOf(parts?.[2]);
      if (lo && hi) out.domain = `${lo[0]},${hi[0]},${lo[1]},${hi[1]}`;
      return out;
    },
    options: { ColorFunction: colorFunction },
  },
  chart("BarChart", "bar"),
  chart("Histogram", "histogram"),
  chart("PieChart", "pie"),
  chart("BoxWhiskerChart", "box"),
  chart("ArrayPlot", "array", { ColorFunction: colorFunction }),
  chart("DiscretePlot", "discrete"),
  {
    // The family head: no `type`, so the component chooses from the data -- unless a
    // second argument names the member (`Chart(data, "pie")`).
    head: "Chart",
    tag: "notatio-chart",
    attributes: (ops) => {
      const out = dataOnly(ops);
      const type = strOf(ops[1]) ?? symOf(ops[1]);
      if (type) out.type = type;
      return out;
    },
    options: { ColorFunction: colorFunction },
  },
  { head: "ListPlot3D", tag: "notatio-list-plot-3d", attributes: dataOnly, options: { ColorFunction: colorFunction } },
  { head: "BarChart3D", tag: "notatio-bar-chart-3d", attributes: dataOnly, options: { ColorFunction: colorFunction } },
  graph("GraphPlot", "graph"),
  graph("TreeGraph", "tree"),
  graph("LayeredGraphPlot", "layered"),
  graph("Dendrogram", "dendrogram"),
  {
    head: "CollectionTable",
    tag: "notatio-collection-table",
    // The collection as a reader will see and retype it: `NonNegativeIntegers`, not Epsil's lowercase spelling.
    attributes: (ops): Record<string, string> =>
      ops[0] === undefined ? {} : { expr: serializeExpression(ops[0], { libraryNames: "mathjson" }) },
  },
  {
    // `Manipulate(body, (a, 0, 5), …)`: the controls become `params`, and the body is a
    // child whose parameters are wildcards -- `_a` -- which is how the component binds
    // a slot (see `captureTemplates`).
    head: "Manipulate",
    tag: "notatio-manipulate",
    prose: true,
    attributes: (ops): Record<string, string> => {
      const params = ops
        .slice(1)
        .map(controlOf)
        .filter((c): c is string => c !== undefined);
      return params.length ? { params: params.join("; ") } : {};
    },
    children: (ops) => {
      const names = new Set(
        ops
          .slice(1)
          .map(controlName)
          .filter((n): n is string => n !== undefined),
      );
      return ops[0] === undefined ? [] : [slotted(ops[0], names)];
    },
  },
  {
    // `TestResultObject(KeyValuePair("Outcome", …), …)` -- `VerificationTest`'s return
    // value (`@enumeratio/evaluation`). Every operand is a `KeyValuePair`, so
    // `optionsOf` (called generically in `render`, below) treats the whole thing as
    // OPTIONS, not positional operands -- this symbol has no `attributes(ops)` of its
    // own, only the option map. `Outcome`/`Input`/`TestID` need no override: their
    // default kebab-cased attribute (`outcome`, `input`, `test-id`) is already right,
    // and the default option text (a string bare, else Epsil) is already what the
    // component wants. `ExpectedOutput`/`ActualOutput` rename to `expected`/`actual`
    // and drop the `Missing` sentinel `declare.ts` fills the gap with; `time` is
    // Wolfram's `AbsoluteTiming`-style name for `AbsoluteTimeUsed`.
    head: "TestResultObject",
    tag: "notatio-test-result-object",
    attributes: () => ({}),
    options: {
      ExpectedOutput: (value): Record<string, string> => (symOf(value) === "Missing" ? {} : { expected: epsil(value) }),
      ActualOutput: (value): Record<string, string> => (symOf(value) === "Missing" ? {} : { actual: epsil(value) }),
      AbsoluteTimeUsed: (value): Record<string, string> => ({ time: epsil(value) }),
    },
  },
];

function vectorField(ops: readonly Json[]): Record<string, string> {
  const out: Record<string, string> = {};
  const field = ops[0];
  if (field !== undefined) {
    const parts = tupleOf(field) ?? [];
    if (parts.length === 2) {
      out.u = epsil(parts[0]);
      out.v = epsil(parts[1]);
    } else out.field = epsil(field);
  }
  const x = iterator(ops[1]);
  const y = iterator(ops[2]);
  if (x.variable) out.xvar = x.variable;
  if (x.range) out.xrange = x.range;
  if (y.variable) out.yvar = y.variable;
  if (y.range) out.yrange = y.range;
  return out;
}

// --- the controls -----------------------------------------------------------------
//
// A control's first argument names the variable it binds -- `Slider(k, (0, 5))` -- or
// carries its starting value too, `Slider((k, 2), (0, 5))`, the way a Manipulate
// parameter does. The rest are the control's own: a range tuple, a list of entries.

/** A control over a range: name, start, and `(min, max, step)`. */
const ranged = (head: string, tag: string, extra: Record<string, string> = {}): VisualSymbol => ({
  head,
  tag,
  fixed: extra,
  control: "ranged",
  attributes: rangedAttributes,
});

/** A control over a list of entries: name, start, and the entries. */
const listed = (head: string, tag: string, extra: Record<string, string> = {}): VisualSymbol => ({
  head,
  tag,
  fixed: extra,
  control: "listed",
  attributes: listedAttributes,
});

/** A control over a point: name, start `(x, y)`, and the corners `((x0, y0), (x1, y1))`. */
const planar = (head: string, tag: string): VisualSymbol => ({
  head,
  tag,
  control: "planar",
  attributes: planarAttributes,
});

/** A control that binds a value with no range to speak of: a checkbox, a color, a field. */
const simple = (head: string, tag: string): VisualSymbol => ({
  head,
  tag,
  control: "simple",
  attributes: simpleAttributes,
});

export const CONTROL_SYMBOLS: readonly VisualSymbol[] = [
  ranged("Slider", "slider-box"),
  ranged("VerticalSlider", "slider-box", { axis: "y" }),
  ranged("Animator", "animator-box"),
  ranged("Knob", "knob-box"),
  { ...ranged("IntervalSlider", "interval-slider-box"), control: "interval", attributes: intervalAttributes },
  planar("Slider2D", "slider-2d-box"),
  listed("SetterBar", "setter-bar-box"),
  listed("RadioButtonBar", "radio-button-bar-box"),
  listed("TogglerBar", "toggler-bar-box"),
  listed("Toggler", "toggler-box"),
  listed("PopupMenu", "popup-menu-box"),
  listed("ListPicker", "list-picker-box"),
  simple("Checkbox", "checkbox-box"),
  simple("ColorSlider", "color-setter-box"),
  simple("InputField", "input-field-box"),
  { ...planar("Locator", "locator-box"), control: "locator", attributes: locatorAttributes },
  {
    head: "Dynamic",
    tag: "dynamic-box",
    attributes: (ops): Record<string, string> => (ops[0] === undefined ? {} : { value: epsil(ops[0]) }),
  },
];

export const CONTROL_HEADS = new Set(CONTROL_SYMBOLS.filter((c) => c.head !== "Dynamic").map((c) => c.head));

// --- layout ---------------------------------------------------------------------------

/** A form's name as the cell's `in-form` / `out-form` take it: `TeXForm` is `tex`. */
const FORM_IDS: Readonly<Record<string, string>> = {
  StandardForm: "standard",
  TraditionalForm: "traditional",
  InputForm: "input",
  MatrixForm: "matrix",
  TreeForm: "tree",
  MathJSON: "full",
  TeXForm: "tex",
  AsciiMathForm: "asciimath",
  MathMLForm: "mathml",
  WolframFullForm: "wolfram",
  PythonForm: "python",
  JavaScriptForm: "javascript",
};
const formId = (value: Json): string | undefined => {
  const name = strOf(value) ?? symOf(value);
  return name === undefined ? undefined : (FORM_IDS[name] ?? name);
};

// `DynamicModule(body)`'s children: a plain body renders as the module's one child; a
// `List` of `Cell`s -- the transcript configuration -- renders each cell as its own
// child, in document order, so `<dynamic-module-box>` sees the same light-DOM shape
// whether it was authored as markup or lowered from this expression.
const dynamicModuleChildren = (ops: readonly Json[]): Json[] =>
  ops[0] === undefined ? [] : (tupleOf(ops[0]) ?? [ops[0]]);

/**
 * `TrackedSymbols -> All | Automatic | True | {a, b}` -- Wolfram's option name for the
 * capability that makes a `DynamicModule` reactive (https://github.com/enumeratio/enumeratio/wiki/Rendering-Environments's
 * companion, `tracked-symbols.ts`): every cell that reads a changed tracked symbol
 * re-evaluates, transitively, instead of the module staying a plain top-to-bottom
 * transcript. Normalised to one attribute, `tracked-symbols`, so the element parses it
 * without walking Epsil again: `"all"` for `All`/`Automatic`/`True`, else a
 * comma-joined symbol list. `False` (or the option simply absent) leaves the attribute
 * unset -- the default, non-reactive configuration.
 */
const trackedSymbolsOption = (value: Json): Record<string, string> => {
  const sym = symOf(value);
  if (sym === "All" || sym === "Automatic" || sym === "True") return { "tracked-symbols": "all" };
  if (sym === "False") return {};
  const names = tupleOf(value)
    ?.map((v) => symOf(v))
    .filter((n): n is string => n !== undefined);
  return names && names.length > 0 ? { "tracked-symbols": names.join(",") } : {};
};

/**
 * `Evaluator -> "Local" | "Worker"` -- Wolfram's own option name, borrowed from
 * `Dynamic` (https://github.com/enumeratio/enumeratio/wiki/Computation): which kernel a `DynamicModule`'s cells evaluate
 * against. `"Local"` (the default, and anything not recognised as `"Worker"`) leaves
 * the attribute unset -- today's in-page evaluation; `"Worker"` sets it, routing
 * evaluation to the module's own `@enumeratio/evaluation/browser` session instead
 * (`dynamic-module-box.ts`'s `evaluateRemote`).
 */
const evaluatorOption = (value: Json): Record<string, string> => {
  const sym = symOf(value);
  return sym === "Worker" ? { evaluator: "worker" } : {};
};

export const LAYOUT_SYMBOLS: readonly VisualSymbol[] = [
  {
    // `DynamicModule(body)` -- an explicit scope over its subtree. The bindings live in
    // the controls inside it, so it takes no arguments of its own; `TrackedSymbols` and
    // `Evaluator` are its options.
    head: "DynamicModule",
    tag: "dynamic-module-box",
    prose: true,
    attributes: () => ({}),
    children: dynamicModuleChildren,
    options: { TrackedSymbols: trackedSymbolsOption, Evaluator: evaluatorOption },
  },
  {
    // `Notebook(cells)` -- Wolfram's name for the transcript configuration: a
    // `DynamicModule` whose body is a `List` of `Cell`s, evaluated in document order in
    // one shared scope. Same tag, same lowering (`TrackedSymbols`/`Evaluator`
    // included); the element tells the two apart by what is actually inside it
    // (`notatio-cell` children) and whether `tracked-symbols` is set, not by which
    // head named it.
    head: "Notebook",
    tag: "dynamic-module-box",
    prose: true,
    attributes: () => ({}),
    children: dynamicModuleChildren,
    options: { TrackedSymbols: trackedSymbolsOption, Evaluator: evaluatorOption },
  },
  {
    // `Cell(expr)`: an In/Out pair -- the held expression as the input, its value as the
    // output. The forms pick the editor and the rendering; `Expected` is the assertion.
    head: "Cell",
    tag: "notatio-cell",
    attributes: (ops): Record<string, string> => (ops[0] === undefined ? {} : { value: epsil(ops[0]) }),
    options: {
      InForm: (value): Record<string, string> => {
        const id = formId(value);
        return id === undefined ? {} : { "in-form": id };
      },
      OutForm: (value): Record<string, string> => {
        const id = formId(value);
        return id === undefined ? {} : { "out-form": id };
      },
      // Parser bookkeeping is not part of the value.
      Expected: (value) => ({
        expect: JSON.stringify(value, (key, v: unknown) => (key === "sourceOffsets" ? undefined : v)),
      }),
    },
  },
  {
    // `StringTemplate("… {_d} …")`: Wolfram's template, with Epsil holes over the variables of
    // the scope it sits in.
    head: "StringTemplate",
    tag: "notatio-string-template",
    attributes: (ops) => ({ template: strOf(ops[0]) ?? "" }),
  },
];

/** An option's value as attribute text: a string bare, `True` as `true`, the rest Epsil. */
function optionText(value: Json): string | undefined {
  const sym = symOf(value);
  if (sym === "True") return "true";
  if (sym === "False") return undefined;
  return strOf(value) ?? epsil(value);
}

/**
 * Lower a head's options (`optionsOf`) into attributes -- and, for a value that is
 * itself something that draws, a slotted child, since an attribute whose value is a
 * node IS a named child. Graphics primitives (`Epilog -> Point((0, 0))`) stay text:
 * the component parses them in its own coordinates.
 */
export function lowerOptions(
  symbol: Pick<VisualSymbol, "options"> | undefined,
  options: Readonly<Record<string, Json>>,
): { attributes: Record<string, string>; children: Rendering[] } {
  const attributes: Record<string, string> = {};
  const children: Rendering[] = [];
  for (const [name, value] of Object.entries(options)) {
    const rule = symbol?.options?.[name];
    if (typeof rule === "function") {
      Object.assign(attributes, rule(value));
      continue;
    }
    const attr = rule ?? optionAttribute(name);
    const drawn = renderingOf(value);
    if (drawn !== undefined && drawn.tag !== "dynamic-module-box") {
      children.push({ ...drawn, attributes: { ...drawn.attributes, slot: attr } });
      continue;
    }
    const text = optionText(value);
    if (text !== undefined) attributes[attr] = text;
  }
  return { attributes, children };
}

const ALL_SYMBOLS: readonly VisualSymbol[] = [...VISUAL_SYMBOLS, ...CONTROL_SYMBOLS, ...LAYOUT_SYMBOLS];

const BY_HEAD = new Map(ALL_SYMBOLS.map((s) => [s.head, s]));

/**
 * Heads that hold their contents as source: a `Cell`'s input is what it evaluates itself, and a
 * `Show`'s layers are read by its element as written (its `Locator(_b)` is a handle on `_b`,
 * not a control declaring it), so the page neither binds the controls inside them nor rewrites
 * or pins them.
 */
export const HELD_HEADS: ReadonlySet<string> = new Set(["Cell", "Show"]);

/** The variables the controls in an expression bind. */
export function controlNames(expr: Json, into = new Set<string>()): Set<string> {
  const head = headOf(expr);
  if (head !== undefined && HELD_HEADS.has(head)) return into;
  if (head !== undefined && CONTROL_HEADS.has(head)) {
    const { name } = variable(opsOf(expr)[0]);
    if (name) into.add(name);
  }
  for (const op of opsOf(expr)) controlNames(op, into);
  return into;
}

/**
 * `name` -> `_name` everywhere a control's variable is READ -- but not where a control
 * declares it, which is its first argument. That is what lets `Row([Slider(k, (0, 5)),
 * Dynamic(k^2)])` bind: the slider keeps `k`, the readout gets `_k`.
 */
export function slottedExceptDeclarations(node: Json, names: ReadonlySet<string>): Json {
  const head = headOf(node);
  if (head !== undefined && HELD_HEADS.has(head)) return node;
  if (head !== undefined && CONTROL_HEADS.has(head)) {
    const ops = opsOf(node);
    const rest = ops.slice(1).map((op) => slottedExceptDeclarations(op, names));
    const fn = [head, ...(ops[0] === undefined ? [] : [ops[0]]), ...rest];
    return Array.isArray(node) ? (fn as unknown as Json) : ({ ...(node as object), fn } as Json);
  }
  const sym = symOf(node);
  if (sym !== undefined && names.has(sym)) {
    return typeof node === "string" ? `_${sym}` : ({ ...(node as object), sym: `_${sym}` } as Json);
  }
  if (Array.isArray(node)) {
    return node.map((n) => slottedExceptDeclarations(n as Json, names)) as unknown as Json;
  }
  const fn = (node as { fn?: unknown[] })?.fn;
  if (Array.isArray(fn)) {
    return {
      ...(node as object),
      fn: fn.map((n) => slottedExceptDeclarations(n as Json, names)),
    } as Json;
  }
  return node;
}

/** The visual symbol behind a head, or undefined for a head that typesets. */
export const visualSymbol = (head: string): VisualSymbol | undefined => BY_HEAD.get(head);

/** Every head that draws: the pictures, the controls, the layout. */
export const DRAWING_SYMBOLS: readonly VisualSymbol[] = ALL_SYMBOLS;

/**
 * The rendering of an expression: its head's component with the arguments as attributes,
 * or `undefined` when the expression is mathematics to typeset rather than a picture.
 *
 * An `Image` is a picture too, drawn by `<img>`; and inside a `Manipulate` a body that is
 * not itself visual is a `<dynamic-box>` -- a readout of the expression over the
 * controls.
 */
export function renderingOf(expr: Json, inManipulate = false): Rendering | undefined {
  // An expression with controls in it is a SCOPE: the controls' variables are read as
  // wildcards everywhere else in it, and a dynamic module around the whole binds them.
  if (!inManipulate) {
    const names = controlNames(expr);
    if (names.size > 0) {
      const inner = render(slottedExceptDeclarations(expr, names), true);
      return inner === undefined ? undefined : { tag: "dynamic-module-box", attributes: {}, children: [inner] };
    }
  }
  return render(expr, inManipulate);
}

/**
 * Heads that are boxes end to end -- `makeBoxes` writes them and the box renderer draws them: the
 * controls and `Dynamic`. (`DynamicModule` can hold a transcript of cells, so its element still
 * comes from the symbol map; the box is what other environments read.)
 */
const BOXED_HEADS: ReadonlySet<string> = new Set([...CONTROL_NOTATION_HEADS].filter((h) => h !== "DynamicModule"));
const isBoxed = (head: string, expr: Json): boolean => BOXED_HEADS.has(head) && optionsOf(expr).ops.length > 0;

function render(expr: Json, inScope: boolean): Rendering | undefined {
  const head = headOf(expr);
  if (head === "Image") {
    const uri = strOf(opsOf(expr)[0]);
    return uri === undefined ? undefined : { tag: "img", attributes: { src: uri } };
  }
  // A string in a layout is a run of text, not a thing to typeset.
  const text = strOf(expr);
  if (text !== undefined && inScope) return { tag: "span", attributes: {}, text };
  if (head !== undefined && (LAYOUT_HEADS.has(head) || isBoxed(head, expr)))
    return layoutRendering(
      expr,
      (node) => render(node, true) ?? { tag: "dynamic-box", attributes: { value: epsil(node) } },
    );
  const found = head === undefined ? undefined : BY_HEAD.get(head);
  const symbol = found?.when?.(opsOf(expr)) === false ? undefined : found;
  if (symbol === undefined) {
    return inScope ? { tag: "dynamic-box", attributes: { value: epsil(expr) } } : undefined;
  }
  // The trailing rules are options, Wolfram's way; the rest are the positional operands.
  const { ops, options } = optionsOf(expr);
  const lowered = lowerOptions(
    symbol,
    symbol.holdsOptions ? Object.fromEntries(Object.entries(options).filter(([k]) => k === "Variables")) : options,
  );
  const held = symbol.holdsOptions
    ? Object.entries(options)
        .filter(([k]) => k !== "Variables")
        .map(([k, v]) => ["KeyValuePair", k, v] as MathJsonExpression)
    : [];
  const attributes = { ...symbol.fixed, ...symbol.attributes([...ops, ...held]), ...lowered.attributes };
  const children = [
    ...(symbol.children?.(ops).map(
      (c) =>
        render(c, true) ?? {
          tag: "dynamic-box",
          attributes: { value: epsil(c) },
        },
    ) ?? []),
    ...lowered.children,
  ];
  return children.length === 0 ? { tag: symbol.tag, attributes } : { tag: symbol.tag, attributes, children };
}

/**
 * `Row`, `Column`, `Grid`, `Panel` and `Labeled` are boxes, not elements: `makeBoxes` writes
 * them, and what an entry is (a control, a plot, a readout of an expression) is a hole the
 * boxes leave for the page to fill with that entry's own rendering (`fill`).
 */
export function layoutRendering(expr: Json, fill: (entry: Json) => Rendering): Rendering {
  const holes: Record<string, Rendering> = {};
  const box = makeBoxes(
    expr as never,
    {},
    {
      leaf: (node) => {
        const head = headOf(node);
        if (head !== undefined && (LAYOUT_HEADS.has(head) || isBoxed(head, node as Json))) return undefined;
        const name = String(Object.keys(holes).length);
        holes[name] = fill(node);
        return slot(name);
      },
    },
  );
  // An option the boxes don't take (`Variables`, which declares a scope) is the root's attribute, as for any head.
  // A control's own options are in its box.
  const head = headOf(expr);
  const rest = Object.fromEntries(
    Object.entries(optionsOf(expr).options).filter(
      ([name]) => !LAYOUT_OPTIONS.has(name) && !(head !== undefined && BOXED_HEADS.has(head)),
    ),
  );
  const drawn = renderBox(box, holes);
  if (Object.keys(rest).length === 0) return drawn;
  const lowered = lowerOptions(undefined, rest);
  return {
    ...drawn,
    attributes: { ...drawn.attributes, ...lowered.attributes },
    children: [...(drawn.children ?? []), ...lowered.children],
  };
}

/** `ImageSize -> [w, h]`'s h among `Show`'s held options, else the element's default height. */
function showHeight(ops: readonly Json[]): number {
  const size = ops.find((op) => headOf(op) === "KeyValuePair" && symOf(opsOf(op)[0]) === "ImageSize");
  const h = numOf(tupleOf(opsOf(size)[1])?.[1]);
  return h !== undefined && h > 0 ? h : SHOW_HEIGHT;
}

/** `<graphics-box>`'s height when `ImageSize` doesn't give one. */
const SHOW_HEIGHT = 480;

/** Escape a value for a double-quoted HTML attribute. */
const attr = (value: string): string => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** A rendering as markup, for a host that can only take HTML. */
export function markupOf(rendering: Rendering): string {
  const attributes = Object.entries(rendering.attributes)
    .map(([k, v]) => ` ${k}="${attr(v)}"`)
    .join("");
  if (rendering.tag === "img") return `<img${attributes}>`;
  const inner =
    rendering.text !== undefined
      ? rendering.text.replace(/&/g, "&amp;").replace(/</g, "&lt;")
      : (rendering.children?.map(markupOf).join("") ?? "");
  return `<${rendering.tag}${attributes}>${inner}</${rendering.tag}>`;
}
