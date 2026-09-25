import { type MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { optionsOf } from "@enumeratio/formats";
import { serializeNotatio } from "@enumeratio/formats/notatio";

// A symbol and its component are the same thing seen from two ends
// (design/components-and-symbols.md). This is the map between them: for every head that
// draws, which tag draws it and where its arguments land as attributes. It is pure --
// no DOM, no Lit -- so it can be read by the docs build to emit the Vue wrappers, by
// `<notatio-out>` to render an evaluated `Plot(…)`, and by anything else that holds an
// expression and wants a picture.
//
// The tag is the naming rule run backwards: kebab-case the symbol, put `notatio-` in
// front. A family component (`notatio-chart`, `notatio-graph-plot`, `notatio-vector-plot`)
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
   * Where a Wolfram option lands when it is not simply the kebab-cased attribute:
   * `PlotLabel` is the plot's `label`, `AxesLabel` is two attributes. A string names
   * the attribute; a function returns the attributes.
   */
  readonly options?: Readonly<
    Record<string, string | ((value: MathJsonExpression) => Record<string, string>)>
  >;
  /** For a control: the shape of what it binds, which is how `reduce` reads it statically. */
  readonly control?: ControlKind;
}

/**
 * What a control's arguments declare: a range `(min, max, step)`, a list of entries, a
 * point in a box, an interval in a range, a point on a plot, or a bare value.
 */
export type ControlKind = "ranged" | "listed" | "planar" | "interval" | "locator" | "simple";

type Json = MathJsonExpression;

export const headOf = (node: unknown): string | undefined => {
  const fn = Array.isArray(node) ? node : (node as { fn?: unknown[] })?.fn;
  return Array.isArray(fn) && typeof fn[0] === "string" ? fn[0] : undefined;
};

export const opsOf = (node: unknown): Json[] => {
  const fn = Array.isArray(node) ? node : (node as { fn?: unknown[] })?.fn;
  return Array.isArray(fn) ? (fn.slice(1) as Json[]) : [];
};

export const symOf = (node: unknown): string | undefined => {
  if (typeof node === "string") return node;
  const sym = (node as { sym?: unknown })?.sym;
  return typeof sym === "string" ? sym : undefined;
};

export const numOf = (node: unknown): number | undefined => {
  if (typeof node === "number") return node;
  const num = (node as { num?: unknown })?.num;
  if (typeof num === "string") return Number(num);
  if (typeof num === "number") return num;
  return undefined;
};

export const strOf = (node: unknown): string | undefined => {
  // A string is `{str}`, or -- the engine's own spelling of a literal -- `'…'`.
  if (typeof node === "string" && node.length >= 2 && node.startsWith("'") && node.endsWith("'")) {
    return node.slice(1, -1);
  }
  const str = (node as { str?: unknown })?.str;
  return typeof str === "string" ? str : undefined;
};

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

/** notatio for an operand, as an attribute value. */
const notatio = (node: Json): string => serializeNotatio(node);

/** MathJSON data -- lists, numbers, strings -- as the plain JSON a `data` attribute takes. */
export function toJsonData(node: Json): unknown {
  const n = numOf(node);
  if (n !== undefined) return n;
  const s = strOf(node);
  if (s !== undefined) return s;
  if (headOf(node) === "List" || headOf(node) === "Tuple") return opsOf(node).map(toJsonData);
  const sym = symOf(node);
  if (sym === "True") return true;
  if (sym === "False") return false;
  return sym ?? notatio(node);
}

const json = (node: Json): string => JSON.stringify(toJsonData(node));

/**
 * The elements of a tuple -- `Tuple` or `List`, or the `Delimiter(Sequence(…))` a LaTeX
 * parse leaves for `(x, 0, 10)` before canonicalisation -- or undefined.
 */
export function tupleOf(node: Json | undefined): Json[] | undefined {
  const head = headOf(node);
  if (head === "Tuple" || head === "List") return opsOf(node);
  if (head === "Delimiter") {
    const inner = opsOf(node)[0];
    if (headOf(inner) === "Sequence") return opsOf(inner);
    return inner === undefined ? undefined : [inner];
  }
  return undefined;
}

/** A Wolfram iterator `(x, a, b)`: the variable and its range, or undefined. */
function iterator(node: Json | undefined): { variable?: string; range?: string } {
  const parts = tupleOf(node);
  if (parts === undefined) return {};
  const [first, lo, hi] = parts;
  const variable = symOf(first);
  const range = lo !== undefined && hi !== undefined ? `${notatio(lo)},${notatio(hi)}` : undefined;
  return { variable, range };
}

/** Attributes for a function of one variable over an iterator. */
function oneVariable(
  ops: readonly Json[],
  names: { value: string; variable: string; range: string },
): Record<string, string> {
  const out: Record<string, string> = {};
  if (ops[0] !== undefined) out[names.value] = notatio(ops[0]);
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
  if (ops[0] !== undefined) out[names.value] = notatio(ops[0]);
  const x = iterator(ops[1]);
  const y = iterator(ops[2]);
  if (x.variable) out[names.x] = x.variable;
  if (x.range) out[names.xrange] = x.range;
  if (y.variable) out[names.y] = y.variable;
  if (y.range) out[names.yrange] = y.range;
  return out;
}

const dataOnly = (ops: readonly Json[]): Record<string, string> =>
  ops[0] === undefined ? {} : { data: json(ops[0]) };

/** A family member: the family tag with the member's attribute fixed. */
const chart = (head: string, type: string): VisualSymbol => ({
  head,
  tag: "notatio-chart",
  fixed: { type },
  attributes: dataOnly,
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
    return inner === undefined ? notatio(p) : `{${inner.map(notatio).join(", ")}}`;
  });
  return parts !== undefined && parts.length >= 2 ? `{${parts.join(", ")}}` : undefined;
}

/** The parameter a control tuple binds. */
function controlName(node: Json): string | undefined {
  const first = tupleOf(node)?.[0];
  const inner = tupleOf(first);
  return symOf(inner === undefined ? first : inner[0]);
}

export const VISUAL_SYMBOLS: readonly VisualSymbol[] = [
  {
    head: "Plot",
    tag: "notatio-plot",
    attributes: (ops) => oneVariable(ops, { value: "value", variable: "var", range: "domain" }),
    options: {
      PlotLabel: "label",
      GridLines: "grid",
      PlotLegends: "legend",
      // `AxesLabel -> ("x", "y")`, or one label for the x axis.
      AxesLabel: (value) => {
        const parts = tupleOf(value) ?? [value];
        const out: Record<string, string> = {};
        if (parts[0] !== undefined) out["x-label"] = strOf(parts[0]) ?? notatio(parts[0]);
        if (parts[1] !== undefined) out["y-label"] = strOf(parts[1]) ?? notatio(parts[1]);
        return out;
      },
      // A range is `(a, b)` for y, or `((x0, x1), (y0, y1))`; the component takes the y pair.
      PlotRange: (value): Record<string, string> => {
        const parts = tupleOf(value);
        if (parts === undefined) return {};
        const y =
          tupleOf(parts[1]) ??
          (parts.length === 2 && tupleOf(parts[0]) === undefined ? parts : undefined);
        return y === undefined ? {} : { "plot-range": y.map(clean).join(",") };
      },
    },
  },
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
  },
  {
    head: "PolarPlot",
    tag: "notatio-polar-plot",
    attributes: (ops) => oneVariable(ops, { value: "expr", variable: "tvar", range: "trange" }),
  },
  {
    head: "VectorPlot",
    tag: "notatio-vector-plot",
    attributes: (ops) => vectorField(ops),
  },
  {
    head: "StreamPlot",
    tag: "notatio-vector-plot",
    fixed: { type: "stream" },
    attributes: (ops) => vectorField(ops),
  },
  {
    head: "ComplexPlot",
    tag: "notatio-complex-plot",
    attributes: (ops) => {
      const out: Record<string, string> = {};
      if (ops[0] !== undefined) out.value = notatio(ops[0]);
      const variable = symOf(ops[1]) ?? iterator(ops[1]).variable;
      if (variable) out.var = variable;
      return out;
    },
  },
  {
    // `ComplexPlot3D(f, (z, a + b i, c + d i))`: the iterator's corners are complex, and
    // the component takes the rectangle they span as `re0,re1,im0,im1`.
    head: "ComplexPlot3D",
    tag: "notatio-complex-plot-3d",
    attributes: (ops) => {
      const out: Record<string, string> = {};
      if (ops[0] !== undefined) out.value = notatio(ops[0]);
      const parts = tupleOf(ops[1]);
      const variable = symOf(ops[1]) ?? symOf(parts?.[0]);
      if (variable) out.var = variable;
      const lo = complexOf(parts?.[1]);
      const hi = complexOf(parts?.[2]);
      if (lo && hi) out.domain = `${lo[0]},${hi[0]},${lo[1]},${hi[1]}`;
      return out;
    },
  },
  chart("ListPlot", "list"),
  chart("ListLinePlot", "listline"),
  chart("BarChart", "bar"),
  chart("Histogram", "histogram"),
  chart("PieChart", "pie"),
  chart("BoxWhiskerChart", "box"),
  chart("ArrayPlot", "array"),
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
  },
  { head: "ListPlot3D", tag: "notatio-list-plot-3d", attributes: dataOnly },
  { head: "BarChart3D", tag: "notatio-bar-chart-3d", attributes: dataOnly },
  graph("GraphPlot", "graph"),
  graph("TreeGraph", "tree"),
  graph("LayeredGraphPlot", "layered"),
  graph("Dendrogram", "dendrogram"),
  {
    head: "CollectionTable",
    tag: "notatio-collection-table",
    attributes: (ops): Record<string, string> =>
      ops[0] === undefined ? {} : { expr: notatio(ops[0]) },
  },
  {
    // `Manipulate(body, (a, 0, 5), …)`: the controls become `params`, and the body is a
    // child whose parameters are wildcards -- `_a` -- which is how the component binds
    // a slot (see `captureTemplates`).
    head: "Manipulate",
    tag: "notatio-manipulate",
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
];

function vectorField(ops: readonly Json[]): Record<string, string> {
  const out: Record<string, string> = {};
  const field = ops[0];
  if (field !== undefined) {
    const parts = tupleOf(field) ?? [];
    if (parts.length === 2) {
      out.u = notatio(parts[0]);
      out.v = notatio(parts[1]);
    } else out.field = notatio(field);
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

/**
 * A number as an attribute: cleaned of the binary noise the notatio parser leaves on a
 * decimal (`0.3` arrives as 0.30000000000000004), which a control would otherwise
 * carry into its readout. Anything else is notatio.
 */
const clean = (node: Json): string => {
  const v = numOf(node);
  return v === undefined ? notatio(node) : String(Number(v.toPrecision(12)));
};

/** `k` or `(k, init)`: the variable and, if given, where it starts. */
export function variable(node: Json | undefined): { name?: string; init?: Json } {
  const parts = tupleOf(node);
  if (parts !== undefined) return { name: symOf(parts[0]), init: parts[1] };
  return { name: symOf(node) };
}

/** `(min, max)` / `(min, max, step)` as attributes. */
function rangeAttributes(node: Json | undefined): Record<string, string> {
  const parts = tupleOf(node);
  const out: Record<string, string> = {};
  if (parts === undefined) return out;
  if (parts[0] !== undefined) out.min = clean(parts[0]);
  if (parts[1] !== undefined) out.max = clean(parts[1]);
  if (parts[2] !== undefined) out.step = clean(parts[2]);
  return out;
}

/** An entry of a choice list: `Labeled(value, "label")` shows one thing and binds another. */
function entryOf(node: Json): string {
  if (headOf(node) === "Labeled") {
    const [value, label] = opsOf(node);
    const text = label === undefined ? undefined : (strOf(label) ?? notatio(label));
    return value === undefined
      ? ""
      : text === undefined
        ? notatio(value)
        : `${notatio(value)} -> ${text}`;
  }
  return strOf(node) ?? notatio(node);
}

/** A list of entries as the `|`-separated `values` attribute. */
const entries = (node: Json | undefined): string | undefined =>
  tupleOf(node)?.map(entryOf).join("|");

/** A control over a range: name, start, and `(min, max, step)`. */
const ranged = (head: string, tag: string, extra: Record<string, string> = {}): VisualSymbol => ({
  head,
  tag,
  fixed: extra,
  control: "ranged",
  attributes: (ops) => {
    const out: Record<string, string> = {};
    const { name, init } = variable(ops[0]);
    if (name) out.name = name;
    if (init !== undefined) out.value = clean(init);
    Object.assign(out, rangeAttributes(ops[1]));
    return out;
  },
});

/** A control over a list of entries: name, start, and the entries. */
const listed = (head: string, tag: string, extra: Record<string, string> = {}): VisualSymbol => ({
  head,
  tag,
  fixed: extra,
  control: "listed",
  attributes: (ops) => {
    const out: Record<string, string> = {};
    const { name, init } = variable(ops[0]);
    if (name) out.name = name;
    if (init !== undefined) {
      // A starting selection is one entry, or a list of them for a multiple choice.
      const many = tupleOf(init);
      out.value =
        many === undefined
          ? entryOf(init).split(" -> ")[0]
          : many.map((v) => entryOf(v).split(" -> ")[0]).join("|");
    }
    const values = entries(ops[1]);
    if (values !== undefined) out.values = values;
    return out;
  },
});

/** A control over a point: name, start `(x, y)`, and the corners `((x0, y0), (x1, y1))`. */
const planar = (head: string, tag: string): VisualSymbol => ({
  head,
  tag,
  control: "planar",
  attributes: (ops) => {
    const out: Record<string, string> = {};
    const { name, init } = variable(ops[0]);
    if (name) out.name = name;
    const point = tupleOf(init);
    if (point !== undefined && point.length === 2) out.value = point.map(clean).join(",");
    const corners = tupleOf(ops[1]);
    const lo = tupleOf(corners?.[0]);
    const hi = tupleOf(corners?.[1]);
    if (lo !== undefined && lo.length === 2) out.min = lo.map(clean).join(",");
    if (hi !== undefined && hi.length === 2) out.max = hi.map(clean).join(",");
    const step = ops[2] === undefined ? undefined : (tupleOf(ops[2]) ?? [ops[2]]);
    if (step !== undefined) out.step = step.map(clean).join(",");
    return out;
  },
});

/** A control that binds a value with no range to speak of: a checkbox, a colour, a field. */
const simple = (head: string, tag: string): VisualSymbol => ({
  head,
  tag,
  control: "simple",
  attributes: (ops) => {
    const out: Record<string, string> = {};
    const { name, init } = variable(ops[0]);
    if (name) out.name = name;
    if (init !== undefined) out.value = strOf(init) ?? notatio(init);
    return out;
  },
});

export const CONTROL_SYMBOLS: readonly VisualSymbol[] = [
  ranged("Slider", "notatio-slider"),
  ranged("VerticalSlider", "notatio-vertical-slider"),
  ranged("Animator", "notatio-animator"),
  ranged("Knob", "notatio-knob"),
  {
    ...ranged("IntervalSlider", "notatio-interval-slider"),
    control: "interval",
    // The start is an interval, `(r, (1, 3))`, which the component takes as `1,3`.
    attributes: (ops) => {
      const out = ranged("IntervalSlider", "notatio-interval-slider").attributes(ops);
      const { init } = variable(ops[0]);
      const pair = tupleOf(init);
      if (pair !== undefined && pair.length === 2) out.value = pair.map(clean).join(",");
      return out;
    },
  },
  planar("Slider2D", "notatio-slider-2d"),
  listed("SetterBar", "notatio-setter-bar"),
  listed("RadioButtonBar", "notatio-radio-button-bar"),
  listed("TogglerBar", "notatio-toggler-bar"),
  listed("Toggler", "notatio-toggler"),
  listed("PopupMenu", "notatio-popup-menu"),
  listed("ListPicker", "notatio-list-picker"),
  simple("Checkbox", "notatio-checkbox"),
  simple("ColorSlider", "notatio-color-slider"),
  simple("InputField", "notatio-input-field"),
  {
    ...planar("Locator", "notatio-locator"),
    control: "locator",
    // A locator has no corners of its own: it takes the plot's.
    attributes: (ops) => {
      const out: Record<string, string> = {};
      const { name, init } = variable(ops[0]);
      if (name) out.name = name;
      const point = tupleOf(init);
      if (point !== undefined && point.length === 2) out.value = point.map(clean).join(",");
      return out;
    },
  },
  {
    head: "Dynamic",
    tag: "notatio-dynamic",
    attributes: (ops): Record<string, string> =>
      ops[0] === undefined ? {} : { value: notatio(ops[0]) },
  },
];

export const CONTROL_HEADS = new Set(
  CONTROL_SYMBOLS.filter((c) => c.head !== "Dynamic").map((c) => c.head),
);

// --- layout ---------------------------------------------------------------------------

/** A layout head's operands render as its children; a list is spread. */
const layout = (head: string, tag: string): VisualSymbol => ({
  head,
  tag,
  attributes: () => ({}),
  children: (ops) => (ops.length === 1 ? (tupleOf(ops[0]) ?? [ops[0]]) : [...ops]),
});

const LABEL_POSITIONS: Readonly<Record<string, string>> = {
  Top: "above",
  Bottom: "below",
  Left: "before",
  Right: "after",
};

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
// child, in document order, so `<notatio-dynamic-module>` sees the same light-DOM shape
// whether it was authored as markup or lowered from this expression.
const dynamicModuleChildren = (ops: readonly Json[]): Json[] =>
  ops[0] === undefined ? [] : (tupleOf(ops[0]) ?? [ops[0]]);

/**
 * `TrackedSymbols -> All | Automatic | True | {a, b}` -- Wolfram's option name for the
 * capability that makes a `DynamicModule` reactive (design/rendering-environments.md's
 * companion, `tracked-symbols.ts`): every cell that reads a changed tracked symbol
 * re-evaluates, transitively, instead of the module staying a plain top-to-bottom
 * transcript. Normalised to one attribute, `tracked-symbols`, so the element parses it
 * without walking notatio again: `"all"` for `All`/`Automatic`/`True`, else a
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

export const LAYOUT_SYMBOLS: readonly VisualSymbol[] = [
  {
    // `DynamicModule(body)` -- an explicit scope over its subtree. The bindings live in
    // the controls inside it, so it takes no arguments of its own; `TrackedSymbols` is
    // its one option.
    head: "DynamicModule",
    tag: "notatio-dynamic-module",
    attributes: () => ({}),
    children: dynamicModuleChildren,
    options: { TrackedSymbols: trackedSymbolsOption },
  },
  {
    // `Notebook(cells)` -- Wolfram's name for the transcript configuration: a
    // `DynamicModule` whose body is a `List` of `Cell`s, evaluated in document order in
    // one shared scope. Same tag, same lowering (`TrackedSymbols` included); the element
    // tells the two apart by what is actually inside it (`notatio-cell` children) and
    // whether `tracked-symbols` is set, not by which head named it.
    head: "Notebook",
    tag: "notatio-dynamic-module",
    attributes: () => ({}),
    children: dynamicModuleChildren,
    options: { TrackedSymbols: trackedSymbolsOption },
  },
  {
    // `Cell(expr)`: an In/Out pair -- the held expression as the input, its value as the
    // output. The forms pick the editor and the rendering; `Expected` is the assertion.
    head: "Cell",
    tag: "notatio-cell",
    attributes: (ops): Record<string, string> =>
      ops[0] === undefined ? {} : { value: notatio(ops[0]) },
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
        expect: JSON.stringify(value, (key, v: unknown) =>
          key === "sourceOffsets" ? undefined : v,
        ),
      }),
    },
  },
  layout("Row", "notatio-row"),
  layout("Column", "notatio-column"),
  {
    // `Grid([[a, b], [c, d]])`: the rows' lengths give the columns, the cells the children.
    head: "Grid",
    tag: "notatio-grid",
    attributes: (ops) => {
      const rows = tupleOf(ops[0]) ?? [];
      const width = Math.max(1, ...rows.map((r) => tupleOf(r)?.length ?? 1));
      return { columns: String(width) };
    },
    children: (ops) => (tupleOf(ops[0]) ?? []).flatMap((r) => tupleOf(r) ?? [r]),
  },
  layout("Panel", "notatio-panel"),
  {
    // `Labeled(body, label, Bottom)`: Wolfram's third argument places the label.
    head: "Labeled",
    tag: "notatio-labeled",
    attributes: (ops): Record<string, string> => {
      const out: Record<string, string> = {};
      const label = ops[1];
      if (label !== undefined) out.label = strOf(label) ?? notatio(label);
      const position = LABEL_POSITIONS[symOf(ops[2]) ?? ""];
      if (position !== undefined) out.position = position;
      return out;
    },
    children: (ops) => (ops[0] === undefined ? [] : [ops[0]]),
  },
];

/** `PlotRange` -> `plot-range`: an option's attribute when the symbol says nothing. */
export const optionAttribute = (name: string): string =>
  name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

/** An option's value as attribute text: a string bare, `True` as `true`, the rest notatio. */
function optionText(value: Json): string | undefined {
  const sym = symOf(value);
  if (sym === "True") return "true";
  if (sym === "False") return undefined;
  return strOf(value) ?? notatio(value);
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
    if (drawn !== undefined && drawn.tag !== "notatio-dynamic-module") {
      children.push({ ...drawn, attributes: { ...drawn.attributes, slot: attr } });
      continue;
    }
    const text = optionText(value);
    if (text !== undefined) attributes[attr] = text;
  }
  return { attributes, children };
}

const ALL_SYMBOLS: readonly VisualSymbol[] = [
  ...VISUAL_SYMBOLS,
  ...CONTROL_SYMBOLS,
  ...LAYOUT_SYMBOLS,
];

const BY_HEAD = new Map(ALL_SYMBOLS.map((s) => [s.head, s]));

/**
 * Heads that hold their contents as source: a `Cell`'s input is what it evaluates itself,
 * so the page neither binds the controls inside it nor rewrites or pins them.
 */
export const HELD_HEADS: ReadonlySet<string> = new Set(["Cell"]);

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
 * not itself visual is a `<notatio-dynamic>` -- a readout of the expression over the
 * controls.
 */
export function renderingOf(expr: Json, inManipulate = false): Rendering | undefined {
  // An expression with controls in it is a SCOPE: the controls' variables are read as
  // wildcards everywhere else in it, and a dynamic module around the whole binds them.
  if (!inManipulate) {
    const names = controlNames(expr);
    if (names.size > 0) {
      const inner = render(slottedExceptDeclarations(expr, names), true);
      return inner === undefined
        ? undefined
        : { tag: "notatio-dynamic-module", attributes: {}, children: [inner] };
    }
  }
  return render(expr, inManipulate);
}

function render(expr: Json, inScope: boolean): Rendering | undefined {
  const head = headOf(expr);
  if (head === "Image") {
    const uri = strOf(opsOf(expr)[0]);
    return uri === undefined ? undefined : { tag: "img", attributes: { src: uri } };
  }
  // A string in a layout is a run of text, not a thing to typeset.
  const text = strOf(expr);
  if (text !== undefined && inScope) return { tag: "span", attributes: {}, text };
  const symbol = head === undefined ? undefined : BY_HEAD.get(head);
  if (symbol === undefined) {
    return inScope ? { tag: "notatio-dynamic", attributes: { value: notatio(expr) } } : undefined;
  }
  // The trailing rules are options, Wolfram's way; the rest are the positional operands.
  const { ops, options } = optionsOf(expr);
  const lowered = lowerOptions(symbol, options);
  const attributes = { ...symbol.fixed, ...symbol.attributes(ops), ...lowered.attributes };
  const children = [
    ...(symbol.children?.(ops).map(
      (c) =>
        render(c, true) ?? {
          tag: "notatio-dynamic",
          attributes: { value: notatio(c) },
        },
    ) ?? []),
    ...lowered.children,
  ];
  return children.length === 0
    ? { tag: symbol.tag, attributes }
    : { tag: symbol.tag, attributes, children };
}

/** Escape a value for a double-quoted HTML attribute. */
const attr = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

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
