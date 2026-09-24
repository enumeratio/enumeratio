// MathJSON → Wolfram Language source. Wolfram's uniform `Head[args]` syntax
// means most of the work is a name map (compute-engine head → WL symbol) plus a
// handful of structural forms; unmapped heads fall through as `Head[args]`, so
// coverage degrades gracefully. Pure (MathJSON in, string out): no compute-engine
// dependency, so it ports cleanly into a compute-engine LanguageTarget later.

export type MathJson =
  | number
  | string
  | boolean
  | { num: string }
  | { str: string }
  | { sym: string }
  | { fn: MathJson[] }
  | MathJson[];

/** compute-engine symbol constants whose Wolfram spelling differs. Exported so
 * `fromWolfram` can build the reverse mapping from the same source. */
export const SYMBOLS: Record<string, string> = {
  Pi: "Pi",
  ExponentialE: "E",
  ImaginaryUnit: "I",
  MachineEpsilon: "$MachineEpsilon",
  GoldenRatio: "GoldenRatio",
  EulerGamma: "EulerGamma",
  CatalanConstant: "Catalan",
  // Our analytic library declares `Catalan` under Wolfram's own spelling, so the constant
  // reaches here by two names. The reverse map keeps `CatalanConstant`, which is the one
  // compute-engine ships.
  Catalan: "Catalan",
  True: "True",
  False: "False",
  NaN: "Indeterminate",
  PositiveInfinity: "Infinity",
  NegativeInfinity: "-Infinity",
  ComplexInfinity: "ComplexInfinity",
  Nothing: "Null",
};

/** compute-engine head → Wolfram head. Identity entries are listed on purpose: the
 * map doubles as the registry of heads the transpiler vouches for (`isWolframHead`),
 * as opposed to heads that merely fall through by name. Exported so `fromWolfram`
 * can build the reverse mapping from the same source. */
export const HEADS: Record<string, string> = {
  // arithmetic / structural
  Add: "Plus",
  Subtract: "Subtract",
  Multiply: "Times",
  Divide: "Divide",
  Negate: "Minus",
  Power: "Power",
  Sqrt: "Sqrt",
  Abs: "Abs",
  Sign: "Sign",
  Floor: "Floor",
  Ceil: "Ceiling",
  Round: "Round",
  Max: "Max",
  Min: "Min",
  Rational: "Rational",
  Complex: "Complex",
  Mod: "Mod",
  N: "N",
  Chop: "Chop",
  Rationalize: "Rationalize",
  Equal: "Equal",
  NotEqual: "Unequal",
  Less: "Less",
  Greater: "Greater",
  LessEqual: "LessEqual",
  GreaterEqual: "GreaterEqual",
  And: "And",
  Or: "Or",
  Not: "Not",
  List: "List",
  Tuple: "List", // Wolfram has no tuple; `{k, 0, 4}` is also how it spells an iterator
  Function: "Function",
  Sum: "Sum",
  Product: "Product",
  // elementary
  Exp: "Exp",
  Ln: "Log",
  Log10: "Log10",
  Log2: "Log2",
  Lb: "Log2",
  Sin: "Sin",
  Cos: "Cos",
  Tan: "Tan",
  Cot: "Cot",
  Sec: "Sec",
  Csc: "Csc",
  Sinh: "Sinh",
  Cosh: "Cosh",
  Tanh: "Tanh",
  Coth: "Coth",
  Sech: "Sech",
  Csch: "Csch",
  Arcsin: "ArcSin",
  Arccos: "ArcCos",
  Arctan: "ArcTan",
  Arsinh: "ArcSinh",
  Arcosh: "ArcCosh",
  Artanh: "ArcTanh",
  // combinatorics / sequences
  Binomial: "Binomial",
  Factorial: "Factorial",
  Factorial2: "Factorial2",
  Subfactorial: "Subfactorial",
  Multinomial: "Multinomial",
  Fibonacci: "Fibonacci",
  LucasL: "LucasL",
  CatalanNumber: "CatalanNumber",
  BellNumber: "BellB",
  BernoulliB: "BernoulliB",
  HarmonicNumber: "HarmonicNumber",
  Stirling: "StirlingS2", // compute-engine `Stirling` is the second kind
  StirlingS1: "StirlingS1",
  Pochhammer: "Pochhammer",
  // Fungrim's name for the same head — see @enumeratio/analytic's rising-factorial.ts.
  RisingFactorial: "Pochhammer",
  // number theory
  IsPrime: "PrimeQ",
  IsSquareFree: "SquareFreeQ",
  Totient: "EulerPhi",
  MoebiusMu: "MoebiusMu",
  PrimePi: "PrimePi",
  NthPrime: "Prime",
  NextPrime: "NextPrime",
  Divisors: "Divisors",
  DivisorSigma: "DivisorSigma",
  PrimeNu: "PrimeNu",
  PrimeOmega: "PrimeOmega",
  FactorInteger: "FactorInteger",
  GCD: "GCD",
  LCM: "LCM",
  ExtendedGCD: "ExtendedGCD",
  PowerMod: "PowerMod",
  PowerModList: "PowerModList",
  MultiplicativeOrder: "MultiplicativeOrder",
  PrimitiveRootList: "PrimitiveRootList",
  Quotient: "Quotient",
  ModularInverse: "ModularInverse",
  ChineseRemainder: "ChineseRemainder",
  JacobiSymbol: "JacobiSymbol",
  LegendreSymbol: "LegendreSymbol",
  KroneckerSymbol: "KroneckerSymbol",
  IntegerExponent: "IntegerExponent",
  HermiteDecomposition: "HermiteDecomposition",
  IntegerDigits: "IntegerDigits",
  FromDigits: "FromDigits",
  IntegerString: "IntegerString",
  DigitCount: "DigitCount",
  ContinuedFraction: "ContinuedFraction",
  // special functions
  Gamma: "Gamma",
  GammaLn: "LogGamma",
  Beta: "Beta",
  Erf: "Erf",
  Erfc: "Erfc",
  ErfInv: "InverseErf",
  Zeta: "Zeta", // one argument is Riemann, two is Hurwitz — in both systems
  HurwitzZeta: "HurwitzZeta",
  LerchPhi: "LerchPhi",
  PolyLog: "PolyLog",
  Digamma: "PolyGamma",
  PolyGamma: "PolyGamma",
  GammaRegularized: "GammaRegularized",
  BetaRegularized: "BetaRegularized",
  ChebyshevT: "ChebyshevT",
  ChebyshevU: "ChebyshevU",
  // Fungrim's name for LegendreP — see @enumeratio/analytic's legendre.ts.
  LegendrePolynomial: "LegendreP",
  // Fungrim's names for the incomplete Legendre elliptic integrals, same (φ, m) order —
  // see @enumeratio/analytic's elliptic.ts.
  IncompleteEllipticF: "EllipticF",
  IncompleteEllipticE: "EllipticE",
  // collections
  At: "Part",
  First: "First",
  Last: "Last",
  Rest: "Rest",
  Most: "Most",
  Take: "Take",
  Drop: "Drop",
  Length: "Length",
  Count: "Count",
  Reverse: "Reverse",
  Sort: "Sort",
  Ordering: "Ordering",
  Partition: "Partition",
  Range: "Range",
  Join: "Join",
  Flatten: "Flatten",
  Append: "Append",
  Prepend: "Prepend",
  Union: "Union",
  Intersection: "Intersection",
  SetMinus: "Complement",
  Dot: "Dot",
  Mean: "Mean",
  Median: "Median",
  Variance: "Variance",
  StandardDeviation: "StandardDeviation",
  Determinant: "Det",
  Filter: "Select",
  Shape: "Dimensions",
  Repeat: "ConstantArray",
  Random: "RandomReal",
  // Divides(a, b) asks whether a divides b; Wolfram's Divisible(n, m) asks whether m
  // divides n — same relation, arguments swapped. See SPECIAL.
  Divides: "Divisible",
  IsComposite: "CompositeQ",

  // ── heads our own libraries add that Wolfram already has, under the same meaning ──
  //
  // These used to fall through by name, which gave the right answer by accident. Listing
  // them makes the claim explicit — and `isWolframHead` then tells the oracle it may probe
  // a kernel for them, which is the point: a head Wolfram can answer is a head we can be
  // cross-checked on.
  CircleTimes: "CircleTimes",
  NonCommutativeMultiply: "NonCommutativeMultiply",
  OverBar: "OverBar",
  CliffordAlgebra: "CliffordAlgebra",
  GrassmannAlgebra: "GrassmannAlgebra",
  // `@enumeratio/geometric`'s outer and regressive products. The rest of that package's
  // heads (Dual, Grade, GradePart, Pseudoscalar, Reversion, GradeInvolution,
  // CliffordConjugate, LeftContraction, RightContraction, ScalarProduct, Sandwich) are
  // names we coined — Wolfram's System` context has no symbol by any of those spellings —
  // so they are left out of both HEADS and FOREIGN and fall through by name, harmlessly.
  Wedge: "Wedge",
  Vee: "Vee",
  MixedRadix: "MixedRadix",
  Coproduct: "Coproduct",
  SymmetricGroup: "SymmetricGroup",
  CyclicGroup: "CyclicGroup",
  DihedralGroup: "DihedralGroup",
  GroupOrder: "GroupOrder",
  GroupElements: "GroupElements",
  FareySequence: "FareySequence",
  IntegerPartitions: "IntegerPartitions",
  Subsets: "Subsets",
  Tuples: "Tuples",
  PermutationCycles: "PermutationCycles",
  Rasterize: "Rasterize",
  // The analytic heads. `LogGamma` is also what `GammaLn` lowers to, so the reverse map
  // keeps `GammaLn` (first entry wins) and this direction is one-way.
  LogGamma: "LogGamma",
  BarnesG: "BarnesG",
  LogBarnesG: "LogBarnesG",
  DirichletEta: "DirichletEta",
  DirichletBeta: "DirichletBeta",
  DirichletCharacter: "DirichletCharacter",
  DirichletL: "DirichletL",
  StieltjesGamma: "StieltjesGamma",
  CarlsonRF: "CarlsonRF",
  CarlsonRC: "CarlsonRC",
  CarlsonRD: "CarlsonRD",
  CarlsonRJ: "CarlsonRJ",
  CarlsonRG: "CarlsonRG",
  // Wolfram's ModularLambda[τ] uses the same λ = θ₂⁴/θ₃⁴ convention (nome q = e^{iπτ}),
  // so this maps directly. `ModularJ` is deliberately NOT mapped here: Wolfram's
  // KleinInvariantJ is j/1728 (a fixed rescaling), and HEADS is a plain name-for-name
  // map with no way to attach that scale — an entry here would silently emit
  // `KleinInvariantJ[τ]` for `ModularJ[τ]`, off by a factor of 1728. `EisensteinG` has
  // no Wolfram counterpart under that name either (checked; Wolfram exposes the
  // invariants via `WeierstrassInvariants`, not a bare Eisenstein-G head), so it is
  // left unmapped too.
  ModularLambda: "ModularLambda",
  // Wolfram spells map composition `Composition`, and reads it right to left as we do.
  Compose: "Composition",

  // ── notatio's graphics and control heads (`@enumeratio/formats/src/graphics.ts`) ──
  //
  // Deliberately Wolfram-named: "Wolfram's `Plot`, `Histogram`, `Manipulate` print as
  // pictures, not formulas" (see that file). We declare them inert — the expression is
  // held rather than computed, for a worksheet or REPL to draw — so this is the same
  // concept under the same name, not a numeric result a kernel oracle could cross-check.
  Plot: "Plot",
  Plot3D: "Plot3D",
  ContourPlot: "ContourPlot",
  DensityPlot: "DensityPlot",
  PolarPlot: "PolarPlot",
  VectorPlot: "VectorPlot",
  StreamPlot: "StreamPlot",
  ComplexPlot: "ComplexPlot",
  ComplexPlot3D: "ComplexPlot3D",
  ListPlot: "ListPlot",
  ListLinePlot: "ListLinePlot",
  ListPlot3D: "ListPlot3D",
  BarChart: "BarChart",
  BarChart3D: "BarChart3D",
  PieChart: "PieChart",
  BoxWhiskerChart: "BoxWhiskerChart",
  ArrayPlot: "ArrayPlot",
  DiscretePlot: "DiscretePlot",
  GraphPlot: "GraphPlot",
  TreeGraph: "TreeGraph",
  LayeredGraphPlot: "LayeredGraphPlot",
  Dendrogram: "Dendrogram",
  Manipulate: "Manipulate",
  Slider: "Slider",
  VerticalSlider: "VerticalSlider",
  Animator: "Animator",
  Slider2D: "Slider2D",
  IntervalSlider: "IntervalSlider",
  SetterBar: "SetterBar",
  RadioButtonBar: "RadioButtonBar",
  TogglerBar: "TogglerBar",
  Toggler: "Toggler",
  PopupMenu: "PopupMenu",
  ListPicker: "ListPicker",
  Checkbox: "Checkbox",
  ColorSlider: "ColorSlider",
  Locator: "Locator",
  InputField: "InputField",
  Dynamic: "Dynamic",
  Row: "Row",
  Column: "Column",
  Grid: "Grid",
  Panel: "Panel",
  Labeled: "Labeled",
  Point: "Point",
  Line: "Line",
  Arrow: "Arrow",
  Circle: "Circle",
  Disk: "Disk",
  Rectangle: "Rectangle",
};

/** Wolfram heads we answer under one of our own heads, but only in a particular CALL
 *  SHAPE rather than as a straight rename — so they cannot live in `HEADS`, which maps
 *  one Wolfram spelling per compute-engine head. `Total[list]` is our `Sum[list]` with
 *  no iterator (see the `Sum` case in `SPECIAL`, and its reverse in `fromWolfram`); a
 *  `Sum` WITH an iterator is Wolfram's own `Sum`, which already occupies that spelling
 *  in `HEADS`. Exported so the frontier generator can exclude these from the gap list
 *  the same way it excludes a plain rename. */
export const STRUCTURAL: Record<string, string> = {
  Total: "Sum",
};

/** The context our heads emit into when Wolfram has the name for something else.
 *
 *  Wolfram's own answer to a name clash, and the reason it has contexts at all. An
 *  `` enumeratio`Area `` is an inert symbol in a context the kernel owns nothing in, so it
 *  cannot be mistaken for `System`Area` — where falling through by NAME would be, silently
 *  and with a plausible-looking result. */
export const CONTEXT = "enumeratio`";

/**
 * Our heads whose Wolfram spelling is taken by an unrelated function, mapped to what
 * Wolfram means by the name. Renaming our side is the wrong fix — a statistic is scoped to
 * its carrier, so sharing a name is an overload — but emitting it as the Wolfram symbol is
 * a wrong answer rather than a missing one, which is worse than either.
 */
export const FOREIGN: Record<string, string> = {
  Area: "the area of a geometric region",
  Perimeter: "the perimeter of a geometric region",
  Depth: "the number of indices needed to reach any part of an expression",
  Order: "the canonical-order comparison Order[a, b]",
  Composition: "a composition of functions, Composition[f, g]",
  Word: "the token specification used by Read and Find",
  Restricted: "an Interpreter form narrowed by a condition",
  // Nearly ours, which is the trap: Wolfram's is a raster image built from a pixel array or
  // a graphics object, never from a URI, so `Image["data:image/png;…"]` is not an image over
  // there — it is an Image of a string.
  Image: "a raster image built from a pixel array or a graphics object",
};

/** Heads that need a bespoke emission rather than a plain rename. */
const SPECIAL: Record<string, (args: MathJson[]) => string> = {
  // compute-engine `Log` is base-10 in the 1-arg form and value-first in the
  // 2-arg form (`Log(value, base)`); Wolfram's `Log` is natural and base-first
  // (`Log[base, value]`), so map and swap.
  Log: (a) =>
    a.length === 1 ? `Log[10, ${toWolfram(a[0])}]` : `Log[${toWolfram(a[1])}, ${toWolfram(a[0])}]`,
  // Root(x, n) is the n-th root; Wolfram `Root` means a polynomial root object.
  Root: (a) => `Power[${toWolfram(a[0])}, Divide[1, ${toWolfram(a[1])}]]`,
  // Wolfram has no `Square`; it is x^2.
  Square: (a) => `Power[${toWolfram(a[0])}, 2]`,
  // compute-engine `Mode` returns the value; Wolfram's `Commonest` returns a list.
  Mode: (a) => `First[Commonest[${toWolfram(a[0])}]]`,
  // Round(x, n) rounds to n decimal places; Wolfram's second argument is a step
  // to round to a multiple of, so n digits is the step 10^-n.
  Round: (a) =>
    a.length === 2
      ? `Round[${toWolfram(a[0])}, Power[10, ${typeof a[1] === "number" ? toWolfram(-a[1]) : `Minus[${toWolfram(a[1])}]`}]]`
      : call("Round", a),
  // Wolfram has no set type; `Union` of one list is the sorted, deduplicated list,
  // which is the closest thing to a canonical set — and what `Intersection` et al
  // return, so set identities still compare Equal.
  Set: (a) => `Union[${call("List", a)}]`,
  // Clamp(x, lo, hi) is Clip[x, {lo, hi}]; the 1-arg form clips to [-1, 1] in both.
  Clamp: (a) =>
    a.length === 3
      ? `Clip[${toWolfram(a[0])}, List[${toWolfram(a[1])}, ${toWolfram(a[2])}]]`
      : call("Clip", a),
  // Wolfram's Sum/Product only take an iterator; the 1-arg list form is Total /
  // Times-apply. With an iterator the names agree and `Tuple` becomes `{k, a, b}`.
  Sum: (a) => (a.length === 1 ? `Total[${toWolfram(a[0])}]` : call("Sum", a)),
  Product: (a) => (a.length === 1 ? `Apply[Times, ${toWolfram(a[0])}]` : call("Product", a)),
  // IndexOf returns 0 when absent; FirstPosition returns Missing unless given a default.
  IndexOf: (a) => `First[FirstPosition[${toWolfram(a[0])}, ${toWolfram(a[1])}, List[0]]]`,
  // No DigitSum in Wolfram: sum the digit list, in whatever base was given.
  DigitSum: (a) => `Total[${call("IntegerDigits", a)}]`,
  // Degrees(x) is the angle x° — Wolfram multiplies by the `Degree` constant.
  Degrees: (a) => `Times[${toWolfram(a[0])}, Degree]`,
  // Divides(a, b) is "a divides b"; Divisible(n, m) is "n is divisible by m" — the
  // same relation with divisor and multiple swapped.
  Divides: (a) => `Divisible[${toWolfram(a[1])}, ${toWolfram(a[0])}]`,
};

/** Whether the transpiler vouches for a head — as opposed to passing it through by name. */
export const isWolframHead = (head: string): boolean => head in HEADS || head in SPECIAL;

const call = (head: string, args: MathJson[]): string =>
  `${head}[${args.map((a) => toWolfram(a)).join(", ")}]`;

/** Serialise a MathJSON value to a Wolfram Language expression string. */
export function toWolfram(node: MathJson): string {
  if (typeof node === "number") return numberToWolfram(node);
  if (typeof node === "boolean") return node ? "True" : "False";
  if (typeof node === "string") return symbolToWolfram(node);

  if (Array.isArray(node)) return applyHead(node[0], node.slice(1));

  if (typeof node === "object") {
    if ("num" in node) return numberToWolfram(node.num);
    if ("str" in node) return JSON.stringify(node.str);
    if ("sym" in node) return symbolToWolfram(node.sym);
    if ("fn" in node) return applyHead(node.fn[0], node.fn.slice(1));
  }
  return "Null";
}

function applyHead(head: MathJson, args: MathJson[]): string {
  if (typeof head !== "string") return call(toWolfram(head), args);
  const special = SPECIAL[head];
  if (special) return special(args);
  if (head in FOREIGN) return call(`${CONTEXT}${head}`, args);
  return call(HEADS[head] ?? head, args);
}

/** A bare MathJSON string is a symbol, a `'quoted'` one a string literal, and
 * `_n` the n-th anonymous-function parameter, which Wolfram spells `Slot[n]`. An
 * underscore is a pattern in Wolfram, never part of a name, so a subscripted
 * symbol like `e_1` becomes `Subscript[e, 1]`. */
function symbolToWolfram(s: string): string {
  if (s.length >= 2 && s.startsWith("'") && s.endsWith("'")) return JSON.stringify(s.slice(1, -1));
  const slot = /^_(\d+)$/.exec(s);
  if (slot) return `Slot[${slot[1]}]`;
  const subscript = /^([A-Za-z][A-Za-z0-9]*)_([A-Za-z0-9]+)$/.exec(s);
  if (subscript) return `Subscript[${subscript[1]}, ${subscript[2]}]`;
  return SYMBOLS[s] ?? s;
}

function numberToWolfram(n: number | string): string {
  const s = String(n).replace(/^\+/, "");
  if (s === "Infinity") return "Infinity";
  if (s === "-Infinity") return "-Infinity";
  if (s === "NaN") return "Indeterminate";
  // Wolfram's exponent marker is `*^`; `1.5e3` would parse as `1.5 * e3`.
  return s.replace(/[eE]\+?/, "*^");
}
