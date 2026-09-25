// GENERATED from YAML by packages/reference/scripts/migrate/shims.ts -- do not edit.
// Edit the YAML named in `sources`, then run `node packages/reference/scripts/migrate/shims.ts`.

import type { ReferenceEntry } from "@enumeratio/entry";

/** The YAML each entry below was generated from, in the same order. */
export const sources: readonly string[] = [
  "packages/symbols/analysis/analytic/reference/CubeRoot.yaml",
  "packages/symbols/analysis/analytic/reference/IntegerPart.yaml",
  "packages/symbols/analysis/analytic/reference/FractionalPart.yaml",
  "packages/symbols/analysis/analytic/reference/RealAbs.yaml",
  "packages/symbols/analysis/analytic/reference/RealSign.yaml",
  "packages/symbols/analysis/analytic/reference/UnitStep.yaml",
  "packages/symbols/analysis/analytic/reference/Gudermannian.yaml",
  "packages/symbols/analysis/analytic/reference/FunctionDomain.yaml",
  "packages/symbols/analysis/analytic/reference/FunctionRange.yaml",
  "packages/symbols/analysis/analytic/reference/FunctionMonotonicity.yaml",
  "packages/symbols/analysis/analytic/reference/FunctionConvexity.yaml",
  "packages/symbols/analysis/analytic/reference/FunctionSign.yaml",
  "packages/symbols/analysis/analytic/reference/FunctionInjective.yaml",
  "packages/symbols/analysis/analytic/reference/FunctionSurjective.yaml",
  "packages/symbols/analysis/analytic/reference/FunctionSingularities.yaml",
  "packages/symbols/analysis/analytic/reference/FunctionDiscontinuities.yaml",
  "packages/symbols/analysis/analytic/reference/FunctionAnalytic.yaml",
  "packages/symbols/analysis/analytic/reference/FunctionMeromorphic.yaml",
  "packages/symbols/analysis/analytic/reference/FunctionPeriod.yaml",
];

export const analyticElementary: readonly ReferenceEntry[] = [
  {
    name: "CubeRoot",
    domain: "Elementary functions",
    signature: "CubeRoot(x)",
    summary: "The real cube root of x.",
    signatures: [
      {
        call: "CubeRoot(x)",
        description: "the real cube root of x.",
        library: "@enumeratio/analytic",
      },
    ],
    details: [
      "Real-valued even at a negative x -- $\\sqrt[3]{-27} = -3$, not a complex principal root. The same real branch as [[Root]]$(x, 3)$; CubeRoot is the named special case.",
      "Threads over a list, element-wise.",
      "An exact non-perfect-cube argument (like $\\sqrt[3]{2}$) stays symbolic under plain evaluation; a floating-point argument, or N(), gives a decimal.",
      "A concretely complex argument is outside CubeRoot's real domain and is left unevaluated.",
    ],
    examples: [
      {
        id: "the-cube-root-of-a-perfect-cube",
        expr: ["CubeRoot", 8],
        expected: 2,
        caption: "The cube root of a perfect cube",
      },
      {
        id: "the-real-root-of-a-negative-number-not-a-complex",
        expr: ["CubeRoot", -27],
        expected: -3,
        caption: "The real root of a negative number, not a complex one",
      },
      {
        id: "at-a-non-perfect-cube-n-forces-the-numeric",
        expr: ["N", ["CubeRoot", 2]],
        expected: 1.2599210498948732,
        caption:
          "At a non-perfect cube, N() forces the numeric branch (plain evaluation stays exact and symbolic)",
      },
      {
        id: "threads-element-wise-over-a-list",
        expr: ["CubeRoot", ["List", -8, 27]],
        expected: ["List", -2, 3],
        category: "Scope",
        caption: "Threads element-wise over a list",
      },
      {
        id: "the-same-as-root-with-index-3",
        expr: ["Equal", ["CubeRoot", -64], ["Root", -64, 3]],
        expected: "True",
        category: "Properties",
        caption: "The same as [[Root]] with index 3",
      },
    ],
  },
  {
    name: "IntegerPart",
    domain: "Elementary functions",
    signature: "IntegerPart(x)",
    summary: "The integer part of x: x truncated toward 0.",
    signatures: [
      {
        call: "IntegerPart(x)",
        description: "x truncated toward 0.",
        library: "@enumeratio/analytic",
      },
    ],
    details: [
      "Truncates toward 0, unlike [[Floor]] (which rounds toward $-\\infty$): $\\mathrm{IntegerPart}(-2.4) = -2$, where $\\mathrm{Floor}(-2.4) = -3$.",
      "Exact at an exact argument -- a rational reduces to an exact integer, and so does a symbolic constant like Pi ($\\mathrm{IntegerPart}(\\pi) = 3$, not a decimal).",
      "At a concretely complex argument, truncates the real and imaginary parts separately.",
      "$x = \\mathrm{IntegerPart}(x) + \\mathrm{FractionalPart}(x)$ always -- see [[FractionalPart]].",
    ],
    examples: [
      { id: "integerpart-2p4", expr: ["IntegerPart", 2.4], expected: 2 },
      {
        id: "truncates-toward-0-unlike-floor",
        expr: ["IntegerPart", -2.4],
        expected: -2,
        caption: "Truncates toward 0, unlike [[Floor]]",
      },
      { id: "integerpart-7-over-2", expr: ["IntegerPart", ["Rational", 7, 2]], expected: 3 },
      { id: "integerpart-neg-7-over-2", expr: ["IntegerPart", ["Rational", -7, 2]], expected: -3 },
      {
        id: "exact-numeric-arguments-stay-exact",
        expr: ["IntegerPart", "Pi"],
        expected: 3,
        category: "Scope",
        caption: "Exact numeric arguments stay exact",
      },
      {
        id: "threads-element-wise-over-a-list",
        expr: ["IntegerPart", ["List", 2.5, -2.5]],
        expected: ["List", 2, -2],
        category: "Scope",
        caption: "Threads element-wise over a list",
      },
      {
        id: "complex-numbers-real-and-imaginary-parts",
        expr: ["IntegerPart", ["Complex", 2.5, 3.7]],
        expected: ["Complex", 2, 3],
        category: "Scope",
        caption: "Complex numbers: real and imaginary parts truncated separately",
      },
      {
        id: "x-integerpart-x-fractionalpart-x",
        expr: [
          "Equal",
          ["Add", ["IntegerPart", ["Rational", -7, 2]], ["FractionalPart", ["Rational", -7, 2]]],
          ["Rational", -7, 2],
        ],
        expected: "True",
        category: "Properties",
        caption: "$x = \\mathrm{IntegerPart}(x) + \\mathrm{FractionalPart}(x)$",
      },
    ],
  },
  {
    name: "FractionalPart",
    domain: "Elementary functions",
    signature: "FractionalPart(x)",
    summary: "The fractional part of x, with the sign of x: x minus its integer part.",
    signatures: [
      {
        call: "FractionalPart(x)",
        description: "x minus [[IntegerPart]](x), with the sign of x.",
        library: "@enumeratio/analytic",
      },
    ],
    details: [
      "Keeps the sign of x, unlike compute-engine's native [[Fract]], which always lands in $[0, 1)$: $\\mathrm{FractionalPart}(-7/2) = -1/2$, where $\\mathrm{Fract}(-7/2) = 1/2$.",
      "Exact where [[IntegerPart]] is: an exact rational reduces to an exact rational, and a symbolic constant like Pi stays exact and symbolic ($\\mathrm{FractionalPart}(\\pi) = \\pi - 3$).",
      "Zero exactly on the integers.",
      "Real domain -- a concretely complex argument is left unevaluated.",
    ],
    examples: [
      { id: "fractionalpart-2p5", expr: ["FractionalPart", 2.5], expected: 0.5 },
      {
        id: "fractionalpart-7-over-2",
        expr: ["FractionalPart", ["Rational", 7, 2]],
        expected: ["Rational", 1, 2],
      },
      {
        id: "keeps-the-sign-of-x-unlike-compute-engine-s",
        expr: ["FractionalPart", ["Rational", -7, 2]],
        expected: ["Rational", -1, 2],
        caption: "Keeps the sign of x, unlike compute-engine's [[Fract]]",
      },
      {
        id: "exact-numeric-arguments-stay-exact",
        expr: ["FractionalPart", "Pi"],
        expected: ["Add", -3, "Pi"],
        category: "Scope",
        caption: "Exact numeric arguments stay exact",
      },
      {
        id: "threads-element-wise-over-a-list",
        expr: ["FractionalPart", ["List", ["Rational", 7, 2], ["Rational", -1, 3]]],
        expected: ["List", ["Rational", 1, 2], ["Rational", -1, 3]],
        category: "Scope",
        caption: "Threads element-wise over a list",
      },
      {
        id: "zero-exactly-on-the-integers",
        expr: ["FractionalPart", 5],
        expected: 0,
        category: "Properties",
        caption: "Zero exactly on the integers",
      },
    ],
  },
  {
    name: "RealAbs",
    domain: "Elementary functions",
    signature: "RealAbs(x)",
    summary: "The absolute value of a real number x, as a function defined only on the reals.",
    signatures: [
      {
        call: "RealAbs(x)",
        description: "the absolute value of the real number x.",
        library: "@enumeratio/analytic",
      },
    ],
    details: [
      'Agrees with native [[Abs]] on every real x -- RealAbs exists so a plot or a domain check can say "real only" and mean it, the way Wolfram\'s does.',
      "A concretely complex argument is outside RealAbs's domain and is left unevaluated -- unlike [[Abs]], which is complex-valued (the modulus).",
    ],
    examples: [
      {
        id: "the-absolute-value-of-a-real-number",
        expr: ["RealAbs", -2.5],
        expected: 2.5,
        caption: "The absolute value of a real number",
      },
      {
        id: "realabs-neg-7-over-2",
        expr: ["RealAbs", ["Rational", -7, 2]],
        expected: ["Rational", 7, 2],
      },
      {
        id: "threads-element-wise-over-a-list",
        expr: ["RealAbs", ["List", -1, 2, -3]],
        expected: ["List", 1, 2, 3],
        category: "Scope",
        caption: "Threads element-wise over a list",
      },
      {
        id: "exact-numeric-arguments",
        expr: ["RealAbs", ["Negate", "Pi"]],
        expected: "Pi",
        category: "Scope",
        caption: "Exact numeric arguments",
      },
      {
        id: "agrees-with-abs-on-the-reals",
        expr: ["Equal", ["RealAbs", -5], ["Abs", -5]],
        expected: "True",
        category: "Properties",
        caption: "Agrees with [[Abs]] on the reals",
      },
    ],
  },
  {
    name: "RealSign",
    domain: "Elementary functions",
    signature: "RealSign(x)",
    summary: "The sign of a real number x: -1, 0 or 1, as a function defined only on the reals.",
    signatures: [
      {
        call: "RealSign(x)",
        description: "-1, 0 or 1, according to the sign of the real number x.",
        library: "@enumeratio/analytic",
      },
    ],
    details: [
      "Restricted to the reals, the sign is always decidable, so RealSign always resolves to an exact -1, 0 or 1 -- unlike native [[Sign]], which stays symbolic at an exact expression it cannot immediately classify (e.g. $\\mathrm{Sign}(\\sqrt2 - 2)$ stays unevaluated under plain evaluation).",
      "A concretely complex argument is outside RealSign's domain and is left unevaluated.",
    ],
    examples: [
      { id: "realsign-neg-3", expr: ["RealSign", -3], expected: -1 },
      { id: "realsign-0", expr: ["RealSign", 0], expected: 0 },
      { id: "realsign-2p5", expr: ["RealSign", 2.5], expected: 1 },
      {
        id: "threads-element-wise-over-a-list",
        expr: ["RealSign", ["List", -2, 0, 5]],
        expected: ["List", -1, 0, 1],
        category: "Scope",
        caption: "Threads element-wise over a list",
      },
      {
        id: "decides-the-sign-of-an-exact-numeric-expression",
        expr: ["RealSign", ["Subtract", ["Sqrt", 2], 2]],
        expected: -1,
        category: "Scope",
        caption: "Decides the sign of an exact numeric expression",
      },
    ],
  },
  {
    name: "UnitStep",
    domain: "Elementary functions",
    signature: "UnitStep(x1, x2, …)",
    summary: "The unit step function: 0 for x < 0 and 1 for x >= 0.",
    signatures: [
      {
        call: "UnitStep(x)",
        description: "0 if x < 0, 1 if x >= 0.",
        library: "@enumeratio/analytic",
      },
      {
        call: "UnitStep(x1, x2, …)",
        description: "the product of the unit steps -- 0 as soon as any argument is negative.",
        library: "@enumeratio/analytic",
        arity: 2,
      },
    ],
    details: [
      "1 at exactly 0, unlike [[Heaviside]]'s $\\tfrac12$ there.",
      "Several arguments: 0 the moment any one of them is negative, 1 otherwise -- the multivariate step used for a region like $x \\ge 0 \\wedge y \\ge 0$.",
      "A single list argument threads element-wise; several scalar arguments combine as above -- the two call forms are not the same shape.",
    ],
    examples: [
      { id: "unitstep-neg-1", expr: ["UnitStep", -1], expected: 0 },
      {
        id: "1-at-0-unlike-heaviside-s-1-2",
        expr: ["UnitStep", 0],
        expected: 1,
        caption: "1 at 0, unlike Heaviside's 1/2",
      },
      { id: "unitstep-2p5", expr: ["UnitStep", 2.5], expected: 1 },
      {
        id: "threads-element-wise-over-a-list",
        expr: ["UnitStep", ["List", -1, 0, 1]],
        expected: ["List", 0, 1, 1],
        category: "Scope",
        caption: "Threads element-wise over a list",
      },
      {
        id: "several-arguments-the-product-of-their-unit",
        expr: ["UnitStep", 1, 2],
        expected: 1,
        category: "Scope",
        caption: "Several arguments: the product of their unit steps",
      },
      {
        id: "zero-as-soon-as-any-argument-is-negative",
        expr: ["UnitStep", 1, -1],
        expected: 0,
        category: "Scope",
        caption: "Zero as soon as any argument is negative",
      },
      {
        id: "exact-numeric-arguments",
        expr: ["UnitStep", ["Subtract", "Pi", 3]],
        expected: 1,
        category: "Scope",
        caption: "Exact numeric arguments",
      },
    ],
  },
  {
    name: "Gudermannian",
    domain: "Elementary functions",
    signature: "Gudermannian(x)",
    summary:
      "The Gudermannian function $\\operatorname{gd}(x) = 2\\arctan(\\tanh(x/2)) = \\arctan(\\sinh(x))$, linking circular and hyperbolic functions without complex numbers.",
    signatures: [
      {
        call: "Gudermannian(x)",
        description: "the Gudermannian function of x.",
        library: "@enumeratio/analytic",
      },
    ],
    details: [
      "$\\operatorname{gd}(0) = 0$, and $\\operatorname{gd}(x) \\to \\pm\\pi/2$ as $x \\to \\pm\\infty$ -- the horizontal asymptotes.",
      "An odd function: $\\operatorname{gd}(-x) = -\\operatorname{gd}(x)$.",
      "$\\operatorname{gd}'(x) = \\operatorname{sech}(x)$; differentiable via [[D]].",
      "Numeric only past the special values above, and real domain -- no reference example calls for a complex argument.",
    ],
    examples: [
      { id: "gudermannian-0", expr: ["Gudermannian", 0], expected: 0 },
      {
        id: "at-a-machine-precision-argument",
        expr: ["Gudermannian", 1.5],
        expected: 1.1317283452505091,
        caption: "At a machine-precision argument",
      },
      {
        id: "horizontal-asymptote-pi-2",
        expr: ["Gudermannian", "PositiveInfinity"],
        expected: ["Multiply", ["Rational", 1, 2], "Pi"],
        category: "Scope",
        caption: "Horizontal asymptote $\\pi/2$",
      },
      {
        id: "gd-x-sech-x",
        expr: ["D", ["Gudermannian", "x"], "x"],
        expected: ["Sech", "x"],
        category: "Scope",
        caption: "$\\operatorname{gd}'(x) = \\operatorname{sech} x$",
      },
      {
        id: "an-odd-function",
        expr: ["Gudermannian", ["Negate", "x"]],
        expected: ["Negate", ["Gudermannian", "x"]],
        category: "Properties",
        caption: "An odd function",
      },
    ],
  },
  {
    name: "FunctionDomain",
    domain: "Elementary functions",
    signature: "FunctionDomain(f, x)",
    summary:
      "The set of real x where f (an expression in the single real variable x) is defined, as a condition in x.",
    signatures: [
      {
        call: "FunctionDomain(f, x)",
        description:
          "the domain of f as a function of the real variable x, expressed as an inequality or a disjunction of inequalities.",
        library: "@enumeratio/analytic",
      },
    ],
    details: [
      "Built on one shared classifier for an elementary real expression in a single variable — see [[FunctionMonotonicity]], [[FunctionRange]], and the rest of the `Function*` family, which all reduce the expression the same way before answering their own question.",
      "Covers: polynomials and rational functions (division by zero, denominator degree <= 2 or a bare power like $x^n$); Sqrt of an affine or quadratic argument (an even root, requiring the radicand >= 0); Ln/Log of an affine argument; and Exp, Sin, Cos, Tan of an affine argument (domain all of $\\mathbb R$, except Tan -- see below).",
      "Declines (leaves the call unevaluated) rather than answer: a second free variable; a denominator or radicand of degree above 2 with more than one term; Log of anything but an affine argument; and Tan, whose true domain excludes a countably infinite set of points ($x \\ne \\pi/2 + k\\pi$) that this file's interval vocabulary cannot express as a finite union of intervals.",
    ],
    examples: [
      {
        id: "a-polynomial-is-defined-everywhere",
        expr: ["FunctionDomain", ["Power", "x", 2], "x"],
        expected: "True",
        caption: "A polynomial is defined everywhere",
      },
      {
        id: "division-by-zero-excludes-the-origin",
        expr: ["FunctionDomain", ["Divide", 1, "x"], "x"],
        expected: ["Or", ["Less", "x", 0], ["Less", 0, "x"]],
        caption: "Division by zero excludes the origin",
      },
      {
        id: "a-rational-function-with-two-real-poles",
        expr: ["FunctionDomain", ["Divide", 1, ["Add", ["Power", "x", 2], -1]], "x"],
        expected: ["Or", ["Less", "x", -1], ["Less", -1, "x", 1], ["Less", 1, "x"]],
        category: "Scope",
        caption: "A rational function with two real poles",
      },
      {
        id: "an-even-root-needs-a-nonnegative-radicand",
        expr: ["FunctionDomain", ["Sqrt", ["Add", ["Power", "x", 2], -1]], "x"],
        expected: ["Or", ["LessEqual", "x", -1], ["LessEqual", 1, "x"]],
        category: "Scope",
        caption: "An even root needs a nonnegative radicand",
      },
      {
        id: "a-natural-log-needs-a-positive-argument",
        expr: ["FunctionDomain", ["Ln", ["Subtract", 2, "x"]], "x"],
        expected: ["Less", "x", 2],
        category: "Scope",
        caption: "A natural log needs a positive argument",
      },
      {
        id: "tangent-s-domain-is-declined",
        expr: ["FunctionDomain", ["Tan", "x"], "x"],
        expected: ["FunctionDomain", ["Tan", "x"], "x"],
        category: "Possible issues",
        caption:
          "Tan's excluded set isn't a finite union of intervals, so this stays unevaluated rather than guess",
      },
    ],
  },
  {
    name: "FunctionRange",
    domain: "Elementary functions",
    signature: "FunctionRange(f, x, y)",
    summary: "The set of values f takes as x ranges over its domain, as a condition in y.",
    signatures: [
      {
        call: "FunctionRange(f, x, y)",
        description:
          "the range of f as a function of the real variable x, expressed as a condition in y.",
        library: "@enumeratio/analytic",
      },
    ],
    details: [
      "Uses the same classifier as [[FunctionDomain]]. An odd-degree polynomial is onto $\\mathbb R$ by the intermediate value theorem regardless of its other coefficients; a degree-2 polynomial's range comes from its vertex.",
      "Covers: odd-degree polynomials (True); degree-2 polynomials (from the vertex); a nonzero constant over an affine denominator ($y \\ne 0$); Sqrt of an affine or quadratic argument; Ln of an affine argument (True); Exp of an affine argument ($y>0$); Sin/Cos of an affine argument ($-1\\le y\\le1$); Tan of an affine argument (True).",
      "Declines for even-degree polynomials above degree 2 (no general closed-form extremum here), and for a rational function whose denominator is a quadratic (needs the same vertex analysis compounded with the reciprocal, left for later).",
    ],
    examples: [
      {
        id: "a-parabola-s-range-is-bounded-below",
        expr: ["FunctionRange", ["Power", "x", 2], "x", "y"],
        expected: ["LessEqual", 0, "y"],
        caption: "A parabola's range is bounded below by its vertex",
      },
      {
        id: "a-reciprocal-never-reaches-zero",
        expr: ["FunctionRange", ["Divide", 1, "x"], "x", "y"],
        expected: ["Or", ["Less", "y", 0], ["Less", 0, "y"]],
        caption: "A reciprocal never reaches zero",
      },
      {
        id: "sine-s-range-is-the-unit-interval",
        expr: ["FunctionRange", ["Sin", "x"], "x", "y"],
        expected: ["LessEqual", -1, "y", 1],
        caption: "Sine's range is the unit interval",
      },
      {
        id: "exp-s-range-is-the-positive-reals",
        expr: ["FunctionRange", ["Exp", "x"], "x", "y"],
        expected: ["Less", 0, "y"],
        category: "Scope",
        caption: "Exp's range is the positive reals",
      },
      {
        id: "a-quadratic-denominator-is-declined",
        expr: ["FunctionRange", ["Divide", 1, ["Add", ["Power", "x", 2], -1]], "x", "y"],
        expected: ["FunctionRange", ["Divide", 1, ["Add", ["Power", "x", 2], -1]], "x", "y"],
        category: "Possible issues",
        caption:
          "A quadratic denominator's range needs its vertex value too, and stays unevaluated for now",
      },
    ],
  },
  {
    name: "FunctionMonotonicity",
    domain: "Elementary functions",
    signature: "FunctionMonotonicity(f, x)",
    summary:
      "1 if f is increasing over its whole domain, -1 if decreasing, 0 if constant, Indeterminate otherwise.",
    signatures: [
      {
        call: "FunctionMonotonicity(f, x)",
        description: "whether f is monotonic in the real variable x over the whole real line.",
        library: "@enumeratio/analytic",
      },
    ],
    details: [
      "Matches Wolfram's own convention, confirmed against `wolframscript`, that a proper (non-`Reals`) domain already answers `Indeterminate` -- `FunctionMonotonicity(Sqrt(x), x)` and `FunctionMonotonicity(Log(x), x)` are `Indeterminate`, not declined, because their domain isn't all of $\\mathbb R$, not because this file can't analyze them.",
      "For a polynomial with domain $\\mathbb R$, the sign of its derivative is read off in closed form -- constant sign (possibly touching zero at one point) gives 1 or -1, a proven sign change gives `Indeterminate`. Exp of an affine argument is always 1 or -1, by the sign of the argument's slope.",
      "Declines only when the classifier itself declines (see [[FunctionDomain]]) or when a polynomial's derivative is a genuine multi-term polynomial of degree > 2 (its sign isn't determined here).",
    ],
    examples: [
      {
        id: "a-cubic-is-increasing-everywhere",
        expr: ["FunctionMonotonicity", ["Power", "x", 3], "x"],
        expected: 1,
        caption: "A cubic is increasing everywhere -- its derivative $3x^2$ never goes negative",
      },
      {
        id: "a-parabola-is-not-globally-monotonic",
        expr: ["FunctionMonotonicity", ["Power", "x", 2], "x"],
        expected: "Indeterminate",
        caption: "A parabola turns around at its vertex",
      },
      {
        id: "exp-of-an-affine-argument-is-always-monotonic",
        expr: ["FunctionMonotonicity", ["Exp", "x"], "x"],
        expected: 1,
        caption: "Exp of an affine argument is always monotonic",
      },
      {
        id: "a-restricted-domain-answers-indeterminate",
        expr: ["FunctionMonotonicity", ["Sqrt", "x"], "x"],
        expected: "Indeterminate",
        category: "Properties",
        caption:
          "Sqrt's domain isn't all of R, so Wolfram's own convention is Indeterminate here -- confirmed against wolframscript",
      },
    ],
  },
  {
    name: "FunctionConvexity",
    domain: "Elementary functions",
    signature: "FunctionConvexity(f, x)",
    summary:
      "1 if f is convex over its whole domain, -1 if concave, 0 if affine, Indeterminate otherwise.",
    signatures: [
      {
        call: "FunctionConvexity(f, x)",
        description:
          "the convexity of f in the real variable x over the whole real line, from the sign of its second derivative.",
        library: "@enumeratio/analytic",
      },
    ],
    details: [
      "Same domain-first convention as [[FunctionMonotonicity]] -- a domain that isn't all of $\\mathbb R$ answers `Indeterminate` (confirmed against `wolframscript`), it isn't a decline.",
      "For a polynomial, reads the sign of the second derivative in closed form; Exp of an affine argument is always convex ($a^2 e^{ax+b}>0$).",
      "Declines only where the classifier itself declines, or where a polynomial's second derivative is a genuine multi-term polynomial of degree > 2.",
    ],
    examples: [
      {
        id: "a-parabola-is-convex",
        expr: ["FunctionConvexity", ["Power", "x", 2], "x"],
        expected: 1,
        caption: "A parabola is convex everywhere",
      },
      {
        id: "a-cubic-has-an-inflection-point",
        expr: ["FunctionConvexity", ["Power", "x", 3], "x"],
        expected: "Indeterminate",
        caption: "A cubic's second derivative changes sign at the inflection point",
      },
      {
        id: "exp-is-always-convex",
        expr: ["FunctionConvexity", ["Exp", "x"], "x"],
        expected: 1,
        caption: "Exp is always convex",
      },
      {
        id: "a-restricted-domain-answers-indeterminate",
        expr: ["FunctionConvexity", ["Divide", 1, "x"], "x"],
        expected: "Indeterminate",
        category: "Properties",
        caption:
          "1/x's domain isn't all of R, so this is Indeterminate rather than a guess about its (genuinely mixed) shape",
      },
    ],
  },
  {
    name: "FunctionSign",
    domain: "Elementary functions",
    signature: "FunctionSign(f, x)",
    summary:
      "1 if f is nonnegative over its whole domain, -1 if nonpositive, Indeterminate otherwise.",
    signatures: [
      {
        call: "FunctionSign(f, x)",
        description:
          "the sign of f in the real variable x, when it is constant over the whole real line.",
        library: "@enumeratio/analytic",
      },
    ],
    details: [
      "Matches Wolfram's convention that this needs domain $\\mathbb R$ to answer definitively -- `FunctionSign(Sqrt(x), x)` is `Indeterminate` even though $\\sqrt x\\ge0$ wherever it's defined, because $\\sqrt x$ isn't defined for every real x (confirmed against `wolframscript`).",
      "A polynomial's sign comes from its closed-form shape (see [[FunctionMonotonicity]]'s classifier); a rational function's sign is the product of its numerator's and denominator's, when both are individually determinate; Exp is always 1.",
    ],
    examples: [
      {
        id: "a-perfect-square-is-never-negative",
        expr: ["FunctionSign", ["Power", "x", 2], "x"],
        expected: 1,
        caption: "A perfect square is never negative",
      },
      {
        id: "a-sum-of-a-square-and-a-positive-constant",
        expr: ["FunctionSign", ["Divide", 1, ["Add", ["Power", "x", 2], 1]], "x"],
        expected: 1,
        caption: "1/(x^2+1) is defined and positive for every real x",
      },
      {
        id: "exp-is-always-positive",
        expr: ["FunctionSign", ["Exp", "x"], "x"],
        expected: 1,
        caption: "Exp is always positive",
      },
      {
        id: "a-cubic-changes-sign",
        expr: ["FunctionSign", ["Power", "x", 3], "x"],
        expected: "Indeterminate",
        category: "Properties",
        caption: "A cubic is negative for x<0 and positive for x>0",
      },
    ],
  },
  {
    name: "FunctionInjective",
    domain: "Elementary functions",
    signature: "FunctionInjective(f, x)",
    summary: "True if distinct x on f's domain always give distinct f(x), False otherwise.",
    signatures: [
      {
        call: "FunctionInjective(f, x)",
        description:
          "whether f, as a function of the real variable x over its own domain, is one-to-one.",
        library: "@enumeratio/analytic",
      },
    ],
    details: [
      "Unlike [[FunctionMonotonicity]], injectivity is asked about f's OWN domain, not all of R -- `1/x` is injective even though $x\\ne0$.",
      "True for an affine function, an odd-power monomial, Exp, Ln, and a nonzero constant over an affine denominator (a Mobius map); False for an even-power monomial and for Tan (periodic, hence many-to-one on its full domain).",
      "Declines for a quadratic radicand or denominator (symmetric about a vertex in ways this file does not chase down in general) and wherever the domain itself declines.",
    ],
    examples: [
      {
        id: "a-reciprocal-is-injective-on-its-own-domain",
        expr: ["FunctionInjective", ["Divide", 1, "x"], "x"],
        expected: "True",
        caption: "A reciprocal is injective on its own domain, even though that domain excludes 0",
      },
      {
        id: "a-cubic-is-injective",
        expr: ["FunctionInjective", ["Power", "x", 3], "x"],
        expected: "True",
        caption: "A cubic is injective (its derivative never goes negative)",
      },
      {
        id: "a-parabola-is-not-injective",
        expr: ["FunctionInjective", ["Power", "x", 2], "x"],
        expected: "False",
        caption: "A parabola gives the same value at x and -x",
      },
      {
        id: "an-affine-function-is-injective",
        expr: ["FunctionInjective", ["Add", ["Multiply", 2, "x"], 1], "x"],
        expected: "True",
        caption: "A nonzero-slope affine function is injective",
      },
    ],
  },
  {
    name: "FunctionSurjective",
    domain: "Elementary functions",
    signature: "FunctionSurjective(f, x, Reals)",
    summary: "True if every real y is f(x) for some x on f's domain, False otherwise.",
    signatures: [
      {
        call: "FunctionSurjective(f, x, Reals)",
        description: "whether f, as a function of the real variable x, is onto the real numbers.",
        library: "@enumeratio/analytic",
      },
    ],
    details: [
      "Only the codomain `Reals` (or `RealNumbers`) is supported -- any other third argument, or none, declines rather than guess at a codomain this file has no notion of.",
      "An odd-degree polynomial and Ln (of an affine argument) are onto R; an even-degree polynomial, Exp, Sqrt, and a nonzero constant over an affine denominator (never zero) are not; Tan is onto R.",
    ],
    examples: [
      {
        id: "an-odd-degree-polynomial-is-onto",
        expr: ["FunctionSurjective", ["Power", "x", 3], "x", "Reals"],
        expected: "True",
        caption:
          "An odd-degree polynomial hits every real value, by the intermediate value theorem",
      },
      {
        id: "exp-misses-the-non-positive-reals",
        expr: ["FunctionSurjective", ["Exp", "x"], "x", "Reals"],
        expected: "False",
        caption: "Exp's range is the positive reals only",
      },
      {
        id: "log-is-onto-the-reals",
        expr: ["FunctionSurjective", ["Ln", "x"], "x", "Reals"],
        expected: "True",
        caption: "Log is onto R even though its domain is only the positive reals",
      },
      {
        id: "a-reciprocal-never-hits-zero",
        expr: ["FunctionSurjective", ["Divide", 1, "x"], "x", "Reals"],
        expected: "False",
        caption: "A reciprocal never takes the value 0",
      },
    ],
  },
  {
    name: "FunctionSingularities",
    domain: "Elementary functions",
    signature: "FunctionSingularities(f, x)",
    summary: "Where f fails to be analytic, as a condition in x.",
    signatures: [
      {
        call: "FunctionSingularities(f, x)",
        description:
          "the set of real x where f is not analytic (a pole, or outside its domain, including its branch points).",
        library: "@enumeratio/analytic",
      },
    ],
    details: [
      "Not simply the complement of [[FunctionDomain]] -- confirmed against `wolframscript`, Sqrt and Log are singular AT their boundary point too, even though the real value there is defined ($\\sqrt0=0$): `FunctionSingularities(Sqrt(x), x)` is `x<=0`, not the strict `x<0` the domain's complement would give.",
      "A polynomial or Exp has none (`False`); a rational function's are the real zeros of its denominator; Sqrt/Ln's are the closed complement of where their argument is positive; Tan's are `Cos(x)==0`.",
    ],
    examples: [
      {
        id: "a-pole-at-the-origin",
        expr: ["FunctionSingularities", ["Divide", 1, "x"], "x"],
        expected: ["Equal", "x", 0],
        caption: "A simple pole at the origin",
      },
      {
        id: "sqrt-is-singular-at-its-own-boundary",
        expr: ["FunctionSingularities", ["Sqrt", "x"], "x"],
        expected: ["LessEqual", "x", 0],
        caption: "Sqrt is singular AT x=0 too, not just where the radicand goes negative",
      },
      {
        id: "a-polynomial-has-no-singularities",
        expr: ["FunctionSingularities", ["Power", "x", 2], "x"],
        expected: "False",
        caption: "A polynomial is entire",
      },
      {
        id: "log-s-branch-cut",
        expr: ["FunctionSingularities", ["Ln", "x"], "x"],
        expected: ["LessEqual", "x", 0],
        caption: "Log's branch cut and its excluded domain coincide here",
      },
    ],
  },
  {
    name: "FunctionDiscontinuities",
    domain: "Elementary functions",
    signature: "FunctionDiscontinuities(f, x)",
    summary: "Where f fails to be continuous, as a condition in x.",
    signatures: [
      {
        call: "FunctionDiscontinuities(f, x)",
        description: "the set of real x where f is discontinuous (or undefined).",
        library: "@enumeratio/analytic",
      },
    ],
    details: [
      "For every shape this file recognizes, confirmed against `wolframscript`, Wolfram's discontinuities coincide exactly with [[FunctionSingularities]] -- a rational function's poles, Sqrt/Ln's closed excluded region, Tan's `Cos(x)==0`, none for a polynomial or Exp. This file shares one implementation between the two heads on that basis; it does not attempt the general theory (a removable discontinuity, a jump discontinuity in a piecewise definition) beyond what the classifier already covers.",
    ],
    examples: [
      {
        id: "a-pole-is-a-discontinuity",
        expr: ["FunctionDiscontinuities", ["Divide", 1, "x"], "x"],
        expected: ["Equal", "x", 0],
        caption: "A pole is a discontinuity",
      },
      {
        id: "tangent-s-poles",
        expr: ["FunctionDiscontinuities", ["Tan", "x"], "x"],
        expected: ["Equal", ["Cos", "x"], 0],
        caption: "Tangent's poles, where cosine vanishes",
      },
      {
        id: "a-polynomial-is-continuous-everywhere",
        expr: ["FunctionDiscontinuities", ["Power", "x", 2], "x"],
        expected: "False",
        caption: "A polynomial is continuous everywhere",
      },
    ],
  },
  {
    name: "FunctionAnalytic",
    domain: "Elementary functions",
    signature: "FunctionAnalytic(f, x)",
    summary: "True if f is analytic (entire) at every real x, False otherwise.",
    signatures: [
      {
        call: "FunctionAnalytic(f, x)",
        description: "whether f, viewed as a function of a complex variable, is entire.",
        library: "@enumeratio/analytic",
      },
    ],
    details: [
      'Confirmed against `wolframscript`, this is stricter than "analytic on its real domain" -- `FunctionAnalytic(1/x, x)` is `False` even though $1/x$ is perfectly analytic away from 0, because it is not analytic EVERYWHERE (it has a pole at $x=0$, real domain or not).',
      "True for a polynomial and Exp/Sin/Cos of an affine argument (all entire); False for any genuine rational function (a nonconstant denominator always has a complex pole somewhere), Sqrt and Ln (a branch point), and Tan (poles where cosine vanishes).",
    ],
    examples: [
      {
        id: "polynomials-are-entire",
        expr: ["FunctionAnalytic", ["Power", "x", 2], "x"],
        expected: "True",
        caption: "Polynomials are entire",
      },
      {
        id: "a-pole-anywhere-in-the-plane-disqualifies-it",
        expr: ["FunctionAnalytic", ["Divide", 1, "x"], "x"],
        expected: "False",
        caption: "A pole anywhere in the complex plane disqualifies it, real domain or not",
      },
      {
        id: "sqrt-has-a-branch-point",
        expr: ["FunctionAnalytic", ["Sqrt", "x"], "x"],
        expected: "False",
        caption: "Sqrt has a branch point at the origin",
      },
      {
        id: "sine-is-entire",
        expr: ["FunctionAnalytic", ["Sin", "x"], "x"],
        expected: "True",
        caption: "Sine is entire",
      },
    ],
  },
  {
    name: "FunctionMeromorphic",
    domain: "Elementary functions",
    signature: "FunctionMeromorphic(f, x)",
    summary:
      "True if f is meromorphic (a ratio of entire functions, poles allowed) everywhere, False otherwise.",
    signatures: [
      {
        call: "FunctionMeromorphic(f, x)",
        description:
          "whether f, viewed as a function of a complex variable, is meromorphic on the whole plane.",
        library: "@enumeratio/analytic",
      },
    ],
    details: [
      "A polynomial, Exp/Sin/Cos of an affine argument (entire, hence trivially meromorphic), a genuine rational function, and Tan ($=\\sin/\\cos$, a ratio of entire functions) are all meromorphic; Sqrt and Ln are not, since a branch point is not a pole.",
      "This is a strictly larger class than [[FunctionAnalytic]] — the one distinction the two heads draw is exactly the poles a rational function or Tan has, which disqualify it from `FunctionAnalytic` but not from this one.",
    ],
    examples: [
      {
        id: "a-rational-function-is-meromorphic",
        expr: ["FunctionMeromorphic", ["Divide", 1, "x"], "x"],
        expected: "True",
        caption: "A rational function is meromorphic even though it isn't entire",
      },
      {
        id: "tangent-is-a-ratio-of-entire-functions",
        expr: ["FunctionMeromorphic", ["Tan", "x"], "x"],
        expected: "True",
        caption: "Tangent is sine over cosine, a ratio of entire functions",
      },
      {
        id: "a-branch-point-is-not-a-pole",
        expr: ["FunctionMeromorphic", ["Ln", "x"], "x"],
        expected: "False",
        caption: "A branch point disqualifies log even though it has no poles",
      },
      {
        id: "polynomials-are-meromorphic",
        expr: ["FunctionMeromorphic", ["Power", "x", 2], "x"],
        expected: "True",
        caption: "Polynomials are entire, hence meromorphic",
      },
    ],
  },
  {
    name: "FunctionPeriod",
    domain: "Elementary functions",
    signature: "FunctionPeriod(f, x)",
    summary: "The fundamental period of f in x, or 0 if f is provably not periodic.",
    signatures: [
      {
        call: "FunctionPeriod(f, x)",
        description:
          "the smallest positive p with f(x+p) = f(x) for every x, or 0 when f is not periodic.",
        library: "@enumeratio/analytic",
      },
    ],
    details: [
      "A nonconstant polynomial, a genuine rational function, Sqrt, Ln, and Exp of a nonconstant affine argument are all provably non-periodic (each is monotonic or unbounded), so this answers `0` for them rather than declining.",
      "Sin/Cos(a x + b) has period $2\\pi/|a|$; Tan(a x + b) has period $\\pi/|a|$.",
      "Does not yet combine periods across a sum of trig terms with different (even commensurate) frequencies, such as $\\sin x + \\cos 2x$ — that composition is outside the single-shape classifier this file is built on, and is declined.",
    ],
    examples: [
      {
        id: "sine-s-period-is-2-pi",
        expr: ["FunctionPeriod", ["Sin", "x"], "x"],
        expected: ["Multiply", 2, "Pi"],
        caption: "Sine's period is 2*pi",
      },
      {
        id: "tangent-s-period-is-pi",
        expr: ["FunctionPeriod", ["Tan", "x"], "x"],
        expected: "Pi",
        caption: "Tangent's period is pi, half of sine's",
      },
      {
        id: "scaling-the-argument-scales-the-period",
        expr: ["FunctionPeriod", ["Sin", ["Multiply", 2, "x"]], "x"],
        expected: "Pi",
        caption: "Doubling the argument halves the period",
      },
      {
        id: "exp-is-not-periodic",
        expr: ["FunctionPeriod", ["Exp", "x"], "x"],
        expected: 0,
        caption: "Exp is monotonic, hence not periodic",
      },
    ],
  },
];
