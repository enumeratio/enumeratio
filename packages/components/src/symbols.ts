import { type MathJsonExpression } from "@cortex-js/compute-engine/epsil";
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

/** What to render: a tag, its attributes, and any children (a `Manipulate` body). */
export interface Rendering {
  readonly tag: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly children?: readonly Rendering[];
}

/** One visual symbol: the tag it renders as, and the attributes its arguments become. */
export interface VisualSymbol {
  readonly head: string;
  readonly tag: string;
  /** Attributes fixed by the symbol itself -- a family member's `type`. */
  readonly fixed?: Readonly<Record<string, string>>;
  /** The argument-to-attribute map, over the head's operands. */
  readonly attributes: (ops: readonly MathJsonExpression[]) => Record<string, string>;
  /** Operands that render as children rather than attributes (a `Manipulate` body). */
  readonly children?: (ops: readonly MathJsonExpression[]) => MathJsonExpression[];
}

type Json = MathJsonExpression;

const headOf = (node: unknown): string | undefined => {
  const fn = Array.isArray(node) ? node : (node as { fn?: unknown[] })?.fn;
  return Array.isArray(fn) && typeof fn[0] === "string" ? fn[0] : undefined;
};

const opsOf = (node: unknown): Json[] => {
  const fn = Array.isArray(node) ? node : (node as { fn?: unknown[] })?.fn;
  return Array.isArray(fn) ? (fn.slice(1) as Json[]) : [];
};

const symOf = (node: unknown): string | undefined => {
  if (typeof node === "string") return node;
  const sym = (node as { sym?: unknown })?.sym;
  return typeof sym === "string" ? sym : undefined;
};

const numOf = (node: unknown): number | undefined => {
  if (typeof node === "number") return node;
  const num = (node as { num?: unknown })?.num;
  if (typeof num === "string") return Number(num);
  if (typeof num === "number") return num;
  return undefined;
};

const strOf = (node: unknown): string | undefined => {
  const str = (node as { str?: unknown })?.str;
  return typeof str === "string" ? str : undefined;
};

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
function tupleOf(node: Json | undefined): Json[] | undefined {
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

const BY_HEAD = new Map(VISUAL_SYMBOLS.map((s) => [s.head, s]));

/** The visual symbol behind a head, or undefined for a head that typesets. */
export const visualSymbol = (head: string): VisualSymbol | undefined => BY_HEAD.get(head);

/**
 * The rendering of an expression: its head's component with the arguments as attributes,
 * or `undefined` when the expression is mathematics to typeset rather than a picture.
 *
 * An `Image` is a picture too, drawn by `<img>`; and inside a `Manipulate` a body that is
 * not itself visual is a `<notatio-dynamic>` -- a readout of the expression over the
 * controls.
 */
export function renderingOf(expr: Json, inManipulate = false): Rendering | undefined {
  const head = headOf(expr);
  if (head === "Image") {
    const uri = strOf(opsOf(expr)[0]);
    return uri === undefined ? undefined : { tag: "img", attributes: { src: uri } };
  }
  const symbol = head === undefined ? undefined : BY_HEAD.get(head);
  if (symbol === undefined) {
    return inManipulate
      ? { tag: "notatio-dynamic", attributes: { value: notatio(expr) } }
      : undefined;
  }
  const ops = opsOf(expr);
  const attributes = { ...symbol.fixed, ...symbol.attributes(ops) };
  const children = symbol.children?.(ops).map(
    (c) =>
      renderingOf(c, true) ?? {
        tag: "notatio-dynamic",
        attributes: { value: notatio(c) },
      },
  );
  return children === undefined
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
  const inner = rendering.children?.map(markupOf).join("") ?? "";
  return `<${rendering.tag}${attributes}>${inner}</${rendering.tag}>`;
}
