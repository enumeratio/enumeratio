import type { ReferenceEntry } from "../types.ts";

// Elementary-function heads `@enumeratio/analytic` adds that compute-engine has no native
// declaration for at all: CubeRoot, IntegerPart/FractionalPart, RealAbs/RealSign, UnitStep,
// and Gudermannian. Every `expected` was produced by evaluating `expr` with compute-engine
// 0.128.0 plus `declareAnalytic`; the reference tests re-evaluate and pin it.
//
// As with the other analytic entries: plain evaluation stays exact wherever an exact answer
// exists (an exact rational, or a symbolic constant like Pi); a floating-point argument (or
// N()) is what asks for a decimal.

const LIBRARY = "@enumeratio/analytic";

export const analyticElementary: readonly ReferenceEntry[] = [
  {
    name: "CubeRoot",
    domain: "Elementary functions",
    signature: "CubeRoot(x)",
    summary: "The real cube root of x.",
    signatures: [
      { call: "CubeRoot(x)", description: "the real cube root of x.", library: LIBRARY },
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
      { call: "IntegerPart(x)", description: "x truncated toward 0.", library: LIBRARY },
    ],
    details: [
      "Truncates toward 0, unlike [[Floor]] (which rounds toward $-\\infty$): $\\mathrm{IntegerPart}(-2.4) = -2$, where $\\mathrm{Floor}(-2.4) = -3$.",
      "Exact at an exact argument -- a rational reduces to an exact integer, and so does a symbolic constant like Pi ($\\mathrm{IntegerPart}(\\pi) = 3$, not a decimal).",
      "At a concretely complex argument, truncates the real and imaginary parts separately.",
      "$x = \\mathrm{IntegerPart}(x) + \\mathrm{FractionalPart}(x)$ always -- see [[FractionalPart]].",
    ],
    examples: [
      {
        id: "integerpart-2p4",
        expr: ["IntegerPart", 2.4],
        expected: 2,
      },
      {
        id: "truncates-toward-0-unlike-floor",
        expr: ["IntegerPart", -2.4],
        expected: -2,
        caption: "Truncates toward 0, unlike [[Floor]]",
      },
      {
        id: "integerpart-7-over-2",
        expr: ["IntegerPart", ["Rational", 7, 2]],
        expected: 3,
      },
      {
        id: "integerpart-neg-7-over-2",
        expr: ["IntegerPart", ["Rational", -7, 2]],
        expected: -3,
      },
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
        library: LIBRARY,
      },
    ],
    details: [
      "Keeps the sign of x, unlike compute-engine's native [[Fract]], which always lands in $[0, 1)$: $\\mathrm{FractionalPart}(-7/2) = -1/2$, where $\\mathrm{Fract}(-7/2) = 1/2$.",
      "Exact where [[IntegerPart]] is: an exact rational reduces to an exact rational, and a symbolic constant like Pi stays exact and symbolic ($\\mathrm{FractionalPart}(\\pi) = \\pi - 3$).",
      "Zero exactly on the integers.",
      "Real domain -- a concretely complex argument is left unevaluated.",
    ],
    examples: [
      {
        id: "fractionalpart-2p5",
        expr: ["FractionalPart", 2.5],
        expected: 0.5,
      },
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
        library: LIBRARY,
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
        library: LIBRARY,
      },
    ],
    details: [
      "Restricted to the reals, the sign is always decidable, so RealSign always resolves to an exact -1, 0 or 1 -- unlike native [[Sign]], which stays symbolic at an exact expression it cannot immediately classify (e.g. $\\mathrm{Sign}(\\sqrt2 - 2)$ stays unevaluated under plain evaluation).",
      "A concretely complex argument is outside RealSign's domain and is left unevaluated.",
    ],
    examples: [
      {
        id: "realsign-neg-3",
        expr: ["RealSign", -3],
        expected: -1,
      },
      {
        id: "realsign-0",
        expr: ["RealSign", 0],
        expected: 0,
      },
      {
        id: "realsign-2p5",
        expr: ["RealSign", 2.5],
        expected: 1,
      },
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
        library: LIBRARY,
      },
      {
        call: "UnitStep(x1, x2, …)",
        description: "the product of the unit steps -- 0 as soon as any argument is negative.",
        library: LIBRARY,
        arity: 2,
      },
    ],
    details: [
      "1 at exactly 0, unlike [[Heaviside]]'s $\\tfrac12$ there.",
      "Several arguments: 0 the moment any one of them is negative, 1 otherwise -- the multivariate step used for a region like $x \\ge 0 \\wedge y \\ge 0$.",
      "A single list argument threads element-wise; several scalar arguments combine as above -- the two call forms are not the same shape.",
    ],
    examples: [
      {
        id: "unitstep-neg-1",
        expr: ["UnitStep", -1],
        expected: 0,
      },
      {
        id: "1-at-0-unlike-heaviside-s-1-2",
        expr: ["UnitStep", 0],
        expected: 1,
        caption: "1 at 0, unlike Heaviside's 1/2",
      },
      {
        id: "unitstep-2p5",
        expr: ["UnitStep", 2.5],
        expected: 1,
      },
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
        library: LIBRARY,
      },
    ],
    details: [
      "$\\operatorname{gd}(0) = 0$, and $\\operatorname{gd}(x) \\to \\pm\\pi/2$ as $x \\to \\pm\\infty$ -- the horizontal asymptotes.",
      "An odd function: $\\operatorname{gd}(-x) = -\\operatorname{gd}(x)$.",
      "$\\operatorname{gd}'(x) = \\operatorname{sech}(x)$; differentiable via [[D]].",
      "Numeric only past the special values above, and real domain -- no reference example calls for a complex argument.",
    ],
    examples: [
      {
        id: "gudermannian-0",
        expr: ["Gudermannian", 0],
        expected: 0,
      },
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
];
