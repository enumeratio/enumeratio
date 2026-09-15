// Example expressions for the source-output (language) pages. Each row shows In
// (StandardForm) → Out (the language's source of the *expression*), with an
// optional note (how it translates / a footgun) or a `divergence` (a "differs
// from <system>" chip). Output is derived live by <notatio-output>, so it can't
// drift. A short editable `sample` per language seeds the try-it cell.

export interface SourceRow {
  readonly expr: unknown;
  readonly label?: string;
  readonly note?: string;
  readonly divergence?: string;
}

export interface SourceLanguageMeta {
  readonly id: string;
  readonly title: string;
  /** The <notatio-output> form that emits this language's source. */
  readonly form: string;
  readonly system: string;
  readonly blurb: string;
  /** LaTeX seeding the editable try-it cell. */
  readonly sample: string;
}

export const sourceLanguages: readonly SourceLanguageMeta[] = [
  {
    id: "wolfram",
    title: "Wolfram FullForm",
    form: "wolfram",
    system: "Wolfram",
    blurb:
      "Wolfram Language full form (functional Head[…]), via @enumeratio/wolfram. Differing names are remapped; unmapped heads pass through as Head[args].",
    sample: "Binomial(n, k) + Sin(x)",
  },
  {
    id: "mathml",
    title: "MathML",
    form: "mathml",
    system: "MathML",
    blurb:
      "Presentation MathML, straight off the MathJSON tree. Output only -- nothing parses it back -- so the emitter owes nothing to round-tripping and picks whatever typesets best.",
    sample: "(x^2 + 1) / Sqrt(y)",
  },
  {
    id: "numpy",
    title: "NumPy",
    form: "python",
    system: "NumPy",
    blurb:
      "Python/NumPy source, via compute-engine's Python target. Numeric and function expressions translate into the np namespace; symbolic-only heads have no NumPy form.",
    sample: "Exp(-x^2) * Cos(x)",
  },
  {
    id: "javascript",
    title: "JavaScript",
    form: "javascript",
    system: "JavaScript",
    blurb:
      "JavaScript source, via compute-engine's default compilation target. Free variables are read off a scope object `_`, and math maps to the `Math` namespace.",
    sample: "Sin(x) / x",
  },
  {
    id: "glsl",
    title: "GLSL",
    form: "glsl",
    system: "GLSL",
    blurb:
      "OpenGL Shading Language source, via compute-engine's GLSL target — the C-like syntax used in fragment/vertex shaders.",
    sample: "Sin(x) * Cos(y)",
  },
  {
    id: "wgsl",
    title: "WGSL",
    form: "wgsl",
    system: "WGSL",
    blurb:
      "WebGPU Shading Language source, via compute-engine's WGSL target — WebGPU's shader language, close to GLSL for scalar math.",
    sample: "x^2 - y^2",
  },
];

const arith: SourceRow = { expr: ["Add", ["Power", "x", 2], 1], label: "arithmetic and powers" };
const trig: SourceRow = { expr: ["Sin", "x"], label: "a function call" };

const wolfram: readonly SourceRow[] = [
  arith,
  trig,
  { expr: ["Binomial", 10, 3], label: "same head" },
  { expr: ["Totient", 12], label: "remapped name: Totient → EulerPhi" },
  { expr: ["Stirling", 5, 2], label: "second-kind Stirling → StirlingS2" },
  { expr: ["Log", 100, 10], label: "rewritten: value-first args flip to base-first" },
  { expr: ["List", 1, 2, 3], label: "a list is List[…]" },
  {
    expr: ["Round", 2.5],
    label: "rounding",
    divergence: "Wolfram evaluates this to 2 (round-half-to-even), not 3 (half-away-from-zero).",
  },
  {
    expr: ["Union", ["List", 3, 1, 2], ["List", 2, 4]],
    label: "set union",
    divergence:
      "Wolfram returns a sorted list {1, 2, 3, 4} rather than preserving encounter order.",
  },
];

// MathML is presentation markup, so the interesting rows are the ones where the tree
// shape and the printed shape part company -- a fraction, a radical, a binomial.
const mathml: readonly SourceRow[] = [
  arith,
  trig,
  { expr: ["Divide", "x", "y"], label: "a fraction is <mfrac>, not an operator" },
  { expr: ["Sqrt", "x"], label: "<msqrt>, with no visible root symbol of its own" },
  { expr: ["Power", "x", 2], label: "<msup>" },
  {
    expr: ["Binomial", "n", "k"],
    label: "binomial",
    note: "A zero-thickness <mfrac> in delimiters -- MathML has no binomial element.",
  },
  { expr: ["List", 1, 2, 3], label: "a list keeps its brackets as <mo>" },
  {
    expr: ["Multiply", ["Add", "a", "b"], "c"],
    label: "parenthesisation is precedence-driven",
    note: "A child is wrapped only when it binds looser than the slot it goes into, the way a TraditionalForm printer decides.",
  },
  {
    expr: ["Totient", 12],
    label: "an unmapped head",
    note: "Falls back to a function call -- <mi>Totient</mi> applied to its arguments -- rather than failing.",
  },
];

const numpy: readonly SourceRow[] = [
  arith,
  trig,
  { expr: ["Abs", "x"], label: "np.abs" },
  { expr: ["Max", "a", "b"], label: "Max → np.maximum (element-wise)" },
  { expr: ["Floor", "x"], label: "np.floor" },
  { expr: ["Exp", "x"], note: "Emitted as np.e ** x, not np.exp(x) — equal, but not the ufunc." },
  { expr: ["Sqrt", "x"], note: "np.emath.sqrt (complex-capable), not np.sqrt." },
  { expr: ["Gamma", "x"], note: "Special functions pull in SciPy: scipy.special.gamma(x)." },
  {
    expr: ["Rational", 1, 2],
    label: "exact rational",
    divergence: "NumPy has no rationals: 1/2 compiles to the float 0.5 — exactness is lost.",
  },
  {
    expr: ["Binomial", "n", "k"],
    note: "No NumPy form — the Python target can't compile Binomial.",
  },
];

const shader: readonly SourceRow[] = [
  arith,
  trig,
  { expr: ["Multiply", ["Sin", "x"], ["Cos", "y"]], label: "products of functions" },
  { expr: ["Subtract", ["Power", "x", 2], ["Power", "y", 2]], label: "a saddle field" },
  { expr: ["Sqrt", ["Add", ["Power", "x", 2], ["Power", "y", 2]]], label: "distance" },
  { expr: ["Abs", "x"], label: "abs" },
  { expr: ["Divide", 1, "x"], label: "division" },
  {
    expr: ["Rational", 1, 2],
    label: "rational",
    note: "Shaders are floating-point: a rational becomes a float literal.",
  },
];

const javascript: readonly SourceRow[] = [
  arith,
  trig,
  { expr: ["Divide", ["Sin", "x"], "x"], label: "the sinc shape" },
  { expr: ["Abs", "x"], label: "Math.abs" },
  { expr: ["Sqrt", "x"], label: "Math.sqrt" },
  { expr: ["Max", "a", "b"], label: "Math.max" },
  { expr: ["Exp", "x"], label: "Math.exp" },
  {
    expr: ["Rational", 1, 2],
    label: "rational",
    note: "A rational becomes a float literal — JavaScript has no exact rationals.",
  },
];

export const sourceRows: Record<string, readonly SourceRow[]> = {
  wolfram,
  mathml,
  numpy,
  javascript,
  glsl: shader,
  wgsl: shader,
};
