import { DEFINITIONS } from "@enumeratio/analytic/definitions";
import type { ReferenceEntry } from "../types.ts";

// Every `expected` was produced by evaluating `expr` with compute-engine 0.128.0
// (the reference tests re-evaluate and pin it). See sibling domain files.
//
// A recurring theme in this domain: compute-engine's plain `.evaluate()` only
// numerically reduces these functions when given an inexact (floating-point)
// argument -- an exact integer or Rational argument is left symbolic unless it
// hits a special closed form (a pole, or an identity like Zeta(2) = pi^2/6).
// `.N()` forces a numeric approximation regardless; several "Possible issues"
// entries below call this out explicitly.
export const specialFunctions: readonly ReferenceEntry[] = [
  {
    name: "Gamma",
    domain: "Special functions",
    signature: "Gamma(z)",
    summary:
      "The gamma function $\\Gamma(z)$, extending the factorial to real and complex arguments; with two arguments, the upper incomplete gamma function.",
    signatures: [
      { call: "Gamma(z)", description: "the gamma function $\\Gamma(z)$." },
      {
        call: "Gamma(s, z)",
        description:
          "the upper incomplete gamma function $\\Gamma(s, z) = \\int_z^\\infty t^{s-1} e^{-t}\\,dt$.",
      },
      {
        call: "Gamma(s, z0, z1)",
        description:
          "the generalized incomplete gamma $\\Gamma(s, z_0) - \\Gamma(s, z_1) = \\int_{z_0}^{z_1} t^{s-1} e^{-t}\\,dt$; at $z_0 = 0$ the LOWER incomplete gamma $\\gamma(s, z_1)$.",
        library: "@enumeratio/analytic",
      },
    ],
    details: [
      "Extends the factorial: $\\Gamma(n) = (n-1)!$ for positive integers n, so [[Factorial]] is $\\Gamma(n+1)$.",
      "Functional equation: $\\Gamma(z+1) = z\\,\\Gamma(z)$.",
      "Reflection formula: $\\Gamma(z)\\,\\Gamma(1-z) = \\dfrac{\\pi}{\\sin(\\pi z)}$, linking $\\Gamma$ at z and $1-z$.",
      "Poles at the nonpositive integers $0, -1, -2, \\ldots$, where $\\Gamma$ diverges to ComplexInfinity.",
      "$\\Gamma(1/2) = \\sqrt{\\pi}$, the constant behind the normal distribution's normalizing factor. See [[Erf]].",
      "compute-engine's plain evaluation leaves Gamma at exact integer or rational arguments unevaluated -- it only reduces to a decimal with N() or when given an inexact (floating-point) argument.",
      "The three-argument form (`@enumeratio/analytic`) is Wolfram's generalized incomplete gamma, the integral between two limits: $\\Gamma(s, z_0, z_1) = \\Gamma(s, z_0) - \\Gamma(s, z_1)$. It is the only spelling here for the LOWER incomplete gamma $\\gamma(s, z) = \\Gamma(s, 0, z)$, which is what the Gamma-distribution CDF and the $\\chi^2$ CDF are built from. See [[GammaRegularized]] for the normalized version.",
      "$\\Gamma(1, z) = e^{-z}$, also supplied by `@enumeratio/analytic` -- exact and valid for symbolic $z$, which is what makes $\\Gamma(1, 0, z)$ collapse to $1 - e^{-z}$ as Wolfram's does.",
    ],
    examples: [
      { expr: ["Gamma", 0], expected: "ComplexInfinity", caption: "A pole of Gamma" },
      {
        expr: ["Gamma", 2.5],
        expected: { num: "1.32934038817913702047" },
        caption: "A floating-point argument evaluates directly to a high-precision decimal",
      },
      {
        expr: ["Gamma", ["List", 0, -1]],
        expected: ["List", "ComplexInfinity", "ComplexInfinity"],
        caption: "Threads over a list, so poles evaluate concretely even inside one",
      },
      {
        expr: ["Equal", ["Gamma", 6], ["Factorial", 5]],
        expected: "True",
        category: "Properties",
        caption: "Extends the factorial: $\\Gamma(n+1) = n!$, so $\\Gamma(6) = 5!$",
      },
      {
        expr: ["Equal", ["Gamma", 6], ["Multiply", 5, ["Gamma", 5]]],
        expected: "True",
        category: "Properties",
        caption: "Functional equation $\\Gamma(z+1) = z\\,\\Gamma(z)$, here at $z = 5$",
      },
      {
        expr: [
          "Equal",
          ["Multiply", ["Gamma", ["Rational", 1, 3]], ["Gamma", ["Rational", 2, 3]]],
          ["Divide", "Pi", ["Sin", ["Divide", "Pi", 3]]],
        ],
        expected: "True",
        category: "Properties",
        caption:
          "Reflection formula $\\Gamma(z)\\Gamma(1-z) = \\pi/\\sin(\\pi z)$, here at $z = 1/3$",
      },
      {
        expr: ["Equal", ["Gamma", ["Rational", 1, 2]], ["Sqrt", "Pi"]],
        expected: "True",
        category: "Properties",
        caption: "$\\Gamma(1/2) = \\sqrt{\\pi}$",
      },
      {
        expr: [
          "Equal",
          ["Divide", ["Power", "Pi", 2], ["Gamma", 3]],
          ["Divide", ["Power", "Pi", 2], 2],
        ],
        expected: "True",
        category: "Applications",
        caption:
          "The volume of a unit 4-ball is $\\pi^{n/2}/\\Gamma(n/2+1)$; at $n=4$ that's $\\pi^2/\\Gamma(3) = \\pi^2/2$",
      },
      {
        expr: ["Gamma", ["Rational", 5, 2]],
        expected: ["Gamma", ["Rational", 5, 2]],
        category: "Possible issues",
        caption:
          "An exact rational argument is left unevaluated under plain evaluation -- pair with N() or use an inexact input like 2.5 for a decimal",
      },
      {
        expr: ["Equal", ["Power", ["Gamma", ["Rational", 1, 2]], 2], "Pi"],
        expected: "True",
        category: "Neat examples",
        caption:
          "Squaring the reflection formula at $z=1/2$ collapses it to $\\Gamma(1/2)^2 = \\pi$",
      },
      {
        expr: ["Gamma", ["List", 1, 2, 3, 4, 5]],
        expected: ["List", 1, 1, 2, 6, 24],
        aspirational: true,
        category: "Scope",
        caption:
          "compute-engine leaves integer $\\Gamma$ arguments symbolic under plain evaluation rather than reducing them to concrete factorials",
      },
      {
        expr: ["Gamma", ["Rational", 5, 2]],
        expected: ["Multiply", ["Rational", 3, 4], ["Sqrt", "Pi"]],
        aspirational: true,
        category: "Scope",
        caption:
          "$\\Gamma(5/2)$ should evaluate to the exact closed form $\\frac{3}{4}\\sqrt{\\pi}$ via the half-integer recurrence; currently rational arguments are left symbolic",
      },
      {
        expr: ["Gamma", 2.5, 0, 1.5],
        expected: 0.3988209453923439,
        caption:
          "Three arguments: the integral between two limits. With $z_0 = 0$ this is the lower incomplete gamma $\\gamma(5/2, 3/2)$",
      },
      {
        expr: ["Gamma", 2.5, 1.5, 3.0],
        expected: 0.5234502669154886,
        caption: "$\\int_{3/2}^{3} t^{3/2} e^{-t}\\,dt = \\Gamma(5/2, 3/2) - \\Gamma(5/2, 3)$",
      },
      {
        expr: ["Gamma", 1, "z"],
        expected: ["Power", "ExponentialE", ["Negate", "z"]],
        category: "Properties",
        caption: "$\\Gamma(1, z) = e^{-z}$, exact and symbolic in $z$",
      },
      {
        expr: ["Gamma", 1, 0, "z"],
        expected: ["Add", ["Negate", ["Power", "ExponentialE", ["Negate", "z"]]], 1],
        category: "Properties",
        caption:
          "…so $\\gamma(1, z) = 1 - e^{-z}$: the exponential distribution's CDF, falling out of the general form",
      },
      {
        expr: ["Gamma", 2, 0, "z"],
        expected: ["Gamma", 2, 0, "z"],
        category: "Possible issues",
        caption:
          "A three-argument call whose two halves do not themselves reduce keeps its own form rather than showing the difference -- Wolfram leaves $\\mathrm{Gamma}[2, 0, z]$ the same way",
      },
    ],
    seeAlso: ["Factorial", "GammaLn", "LogGamma", "GammaRegularized", "Digamma", "Beta"],
  },
  {
    name: "GammaLn",
    domain: "Special functions",
    signature: "GammaLn(z)",
    summary:
      "The natural logarithm of $\\Gamma(z)$, avoiding the overflow of computing [[Gamma]] directly for large z.",
    signatures: [
      {
        call: "GammaLn(z)",
        description: "$\\ln \\Gamma(z)$, useful where $\\Gamma(z)$ itself would overflow.",
      },
    ],
    details: [
      "Defined via [[Gamma]]: $\\operatorname{GammaLn}(z) = \\ln \\Gamma(z)$ for $z > 0$, where $\\Gamma$ is positive so no branch-cut ambiguity arises.",
      "Called gammaln in MATLAB and SciPy, lgamma in C's math library.",
      "Inherits Gamma's recurrence in log form: $\\operatorname{GammaLn}(z+1) = \\operatorname{GammaLn}(z) + \\ln z$.",
      "$\\operatorname{GammaLn}(1/2) = \\frac{1}{2}\\ln \\pi$, from $\\Gamma(1/2) = \\sqrt{\\pi}$.",
      "Diverges to $+\\infty$ at the nonpositive integers, the poles of Gamma -- the log of a diverging magnitude, rather than the ComplexInfinity that [[Gamma]] itself returns there.",
      "It is $\\ln(\\Gamma(z))$ with a PRINCIPAL logarithm, which for complex $z$ is not the same function as Wolfram's $\\mathrm{LogGamma}$: the two differ by multiples of $2\\pi i$ off the positive axis. [[LogGamma]] is that continuation, and the one to use where continuity in $z$ matters.",
    ],
    examples: [
      {
        expr: ["GammaLn", 0],
        expected: "PositiveInfinity",
        caption: "A pole of Gamma, in log form",
      },
      {
        expr: ["GammaLn", 2.5],
        expected: { num: "0.284682870472919159632" },
        caption: "A floating-point argument evaluates directly to a high-precision decimal",
      },
      {
        expr: ["Equal", ["GammaLn", 5], ["Ln", ["Gamma", 5]]],
        expected: "True",
        category: "Properties",
        caption: "Defined as $\\ln \\Gamma(z)$, here at $z = 5$",
      },
      {
        expr: ["Equal", ["GammaLn", 1], 0],
        expected: "True",
        category: "Properties",
        caption: "$\\operatorname{GammaLn}(1) = \\ln \\Gamma(1) = \\ln 1 = 0$",
      },
      {
        expr: ["Equal", ["GammaLn", 6], ["Add", ["GammaLn", 5], ["Ln", 5]]],
        expected: "True",
        category: "Properties",
        caption:
          "Inherits Gamma's recurrence: $\\operatorname{GammaLn}(z+1) = \\operatorname{GammaLn}(z) + \\ln z$",
      },
      {
        expr: [
          "Equal",
          ["GammaLn", ["Rational", 1, 2]],
          ["Multiply", ["Rational", 1, 2], ["Ln", "Pi"]],
        ],
        expected: "True",
        category: "Properties",
        caption:
          "$\\operatorname{GammaLn}(1/2) = \\frac12 \\ln \\pi$, from $\\Gamma(1/2) = \\sqrt{\\pi}$",
      },
      {
        expr: ["Equal", ["GammaLn", 11], ["Ln", ["Factorial", 10]]],
        expected: "True",
        category: "Applications",
        caption:
          "Used to get $\\ln(n!)$ for large n without overflowing float64: $\\ln(10!) = \\operatorname{GammaLn}(11)$",
      },
      {
        expr: ["GammaLn", 5],
        expected: ["GammaLn", 5],
        category: "Possible issues",
        caption:
          "An exact integer argument is left unevaluated under plain evaluation -- pair with N() or use an inexact argument like 2.5 for a decimal. See [[Gamma]]",
      },
      {
        expr: ["Equal", ["GammaLn", 101], ["Ln", ["Factorial", 100]]],
        expected: "True",
        category: "Neat examples",
        caption:
          "$\\operatorname{GammaLn}(101)$ is exactly $\\ln(100!)$, letting us reason about the size of the 158-digit number $100!$ without computing it",
      },
      {
        expr: ["GammaLn", -1],
        expected: "ComplexInfinity",
        aspirational: true,
        category: "Scope",
        caption:
          "compute-engine treats GammaLn as a real log-magnitude and returns PositiveInfinity at Gamma's poles (rather than a complex-analytic ComplexInfinity)",
      },
    ],
    seeAlso: ["Gamma", "LogGamma", "Digamma"],
  },
  {
    name: "Beta",
    domain: "Special functions",
    signature: "Beta(a, b)",
    summary:
      "Euler's beta function $B(a, b) = \\Gamma(a)\\Gamma(b)/\\Gamma(a+b)$, a bridge between [[Gamma]] and [[Binomial]] and the normalizing constant behind the beta distribution.",
    signatures: [{ call: "Beta(a, b)", description: "the Euler beta function $B(a, b)$." }],
    details: [
      "Defined via [[Gamma]]: $B(a, b) = \\dfrac{\\Gamma(a)\\,\\Gamma(b)}{\\Gamma(a+b)}$.",
      "Symmetric: $B(a, b) = B(b, a)$.",
      "Integral form: $B(a, b) = \\int_0^1 t^{a-1}(1-t)^{b-1}\\,dt$.",
      "Ties to [[Binomial]]: $B(k+1, n-k+1) = \\dfrac{1}{(n+1)\\binom{n}{k}}$.",
      "compute-engine evaluates Beta exactly for positive-integer a and b (an exact rational result) and detects the poles at nonpositive integers, returning ComplexInfinity.",
    ],
    examples: [
      { expr: ["Beta", 2, 3], expected: ["Rational", 1, 12] },
      {
        expr: ["Beta", 1, 1],
        expected: 1,
        caption: "The unit square case: $\\int_0^1 1\\,dt = 1$",
      },
      { expr: ["Beta", 3, 3], expected: ["Rational", 1, 30] },
      {
        expr: ["Beta", ["List", 1, 2], 2],
        expected: ["List", ["Rational", 1, 2], ["Rational", 1, 6]],
        caption: "Threads element-wise over a list argument",
      },
      {
        expr: ["Equal", ["Beta", 2, 5], ["Beta", 5, 2]],
        expected: "True",
        category: "Properties",
        caption: "Symmetric: $B(a, b) = B(b, a)$",
      },
      {
        expr: ["Equal", ["Multiply", 9, ["Multiply", ["Beta", 4, 6], ["Binomial", 8, 3]]], 1],
        expected: "True",
        category: "Properties",
        caption:
          "Ties to Binomial: $B(k+1, n-k+1) = \\frac{1}{(n+1)\\binom{n}{k}}$, here at $n=8, k=3$. See [[Binomial]]",
      },
      {
        expr: ["Beta", 0.5, 0.5],
        expected: { num: "3.14159265358979323846" },
        category: "Applications",
        caption: "$B(1/2, 1/2) = \\pi$ underlies the arcsine distribution's normalizing constant",
      },
      {
        expr: ["Beta", -1, 2],
        expected: "ComplexInfinity",
        category: "Possible issues",
        caption:
          "A nonpositive-integer argument is a pole of the underlying Gamma functions, so compute-engine returns ComplexInfinity rather than leaving it unevaluated. See [[Gamma]]",
      },
      {
        expr: ["Beta", ["Rational", 9, 2], ["Rational", 7, 2]],
        expected: ["Multiply", ["Rational", 5, 2048], "Pi"],
        aspirational: true,
        category: "Scope",
        caption:
          "Half-integer arguments should evaluate to the exact closed form $\\frac{5\\pi}{2048}$ via Gamma; currently left unevaluated. Compare [[Binomial]]'s own half-integer gap",
      },
    ],
    seeAlso: ["Gamma", "Binomial", "BetaRegularized"],
  },
  {
    name: "Erf",
    domain: "Special functions",
    signature: "Erf(z)",
    summary:
      "The Gauss error function $\\operatorname{erf}(z) = \\frac{2}{\\sqrt\\pi}\\int_0^z e^{-t^2}\\,dt$, the shape behind the normal distribution's CDF.",
    signatures: [
      { call: "Erf(z)", description: "the Gauss error function $\\operatorname{erf}(z)$." },
    ],
    details: [
      "Odd function: $\\operatorname{erf}(-z) = -\\operatorname{erf}(z)$.",
      "$\\operatorname{erf}(0) = 0$, and $\\operatorname{erf}(\\pm\\infty) = \\pm 1$ -- the total (signed) area under the Gaussian.",
      "Complementary with [[Erfc]]: $\\operatorname{erf}(z) + \\operatorname{erfc}(z) = 1$.",
      "Builds the normal CDF: $\\Phi(x) = \\frac{1}{2}\\left(1 + \\operatorname{erf}(x/\\sqrt{2})\\right)$.",
      "compute-engine requires an inexact (floating-point) argument to produce a numeric value under plain evaluation; an exact integer or rational argument is left symbolic outside the special points 0 and $\\pm\\infty$.",
    ],
    examples: [
      { expr: ["Erf", 0], expected: 0 },
      { expr: ["Erf", "Infinity"], expected: 1 },
      { expr: ["Erf", "NegativeInfinity"], expected: -1 },
      {
        expr: ["Erf", 0.5],
        expected: { num: "0.520499877813046537683" },
        caption: "A floating-point argument evaluates directly to a high-precision decimal",
      },
      {
        expr: ["Equal", ["Add", ["Erf", 2], ["Erf", -2]], 0],
        expected: "True",
        category: "Properties",
        caption:
          "Odd function: $\\operatorname{erf}(-z) = -\\operatorname{erf}(z)$, here at $z = 2$",
      },
      {
        expr: ["Equal", ["Add", ["Erf", 2], ["Erfc", 2]], 1],
        expected: "True",
        category: "Properties",
        caption:
          "Complementary with Erfc: $\\operatorname{erf}(z) + \\operatorname{erfc}(z) = 1$. See [[Erfc]]",
      },
      {
        expr: ["Erf", 0.7071067811865476],
        expected: { num: "0.68268949213708594891" },
        category: "Applications",
        caption:
          "$\\operatorname{erf}(1/\\sqrt2) \\approx 0.6827$: the '68' in the empirical 68-95-99.7 rule for one standard deviation",
      },
      {
        expr: ["Erf", 1],
        expected: ["Erf", 1],
        category: "Possible issues",
        caption:
          "An exact integer argument is left unevaluated under plain evaluation -- pair with N() or use an inexact argument like 0.5 for a decimal",
      },
      {
        expr: ["Erf", 3.5],
        expected: { num: "0.999999256901627658587" },
        category: "Neat examples",
        caption: "By $z=3.5$, erf is already within $10^{-6}$ of its limit of 1",
      },
      {
        expr: ["Erf", ["List", 0, 1]],
        expected: ["List", 0, ["Erf", 1]],
        aspirational: true,
        category: "Scope",
        caption:
          "compute-engine's Erf rejects a list argument outright with a type error (it does not thread over a list)",
      },
    ],
    seeAlso: ["Erfc", "ErfInv"],
  },
  {
    name: "Erfc",
    domain: "Special functions",
    signature: "Erfc(z)",
    summary:
      "The complementary error function $\\operatorname{erfc}(z) = 1 - \\operatorname{erf}(z)$, the Gaussian's tail-probability integral.",
    signatures: [
      {
        call: "Erfc(z)",
        description:
          "the complementary error function $\\operatorname{erfc}(z) = 1 - \\operatorname{erf}(z)$.",
      },
    ],
    details: [
      "Defined as $\\operatorname{erfc}(z) = 1 - \\operatorname{erf}(z)$. See [[Erf]].",
      "$\\operatorname{erfc}(0) = 1$, $\\operatorname{erfc}(\\infty) = 0$, $\\operatorname{erfc}(-\\infty) = 2$.",
      "$\\operatorname{erfc}(-z) = 2 - \\operatorname{erfc}(z)$, the mirror image of Erf's oddness.",
      "Computed directly from a continued fraction for large $|z|$ rather than as $1-\\operatorname{erf}(z)$, since that subtraction would lose all precision once $\\operatorname{erf}(z)$ rounds to $\\pm1$.",
      "compute-engine requires an inexact (floating-point) argument to produce a numeric value under plain evaluation, the same convention as [[Erf]].",
    ],
    examples: [
      { expr: ["Erfc", 0], expected: 1 },
      { expr: ["Erfc", "Infinity"], expected: 0 },
      { expr: ["Erfc", "NegativeInfinity"], expected: 2 },
      {
        expr: ["Erfc", 0.5],
        expected: { num: "0.479500122186953462317" },
        caption: "A floating-point argument evaluates directly to a high-precision decimal",
      },
      {
        expr: ["Equal", ["Add", ["Erfc", -1], ["Erfc", 1]], 2],
        expected: "True",
        category: "Properties",
        caption: "$\\operatorname{erfc}(-z) = 2 - \\operatorname{erfc}(z)$, here at $z = 1$",
      },
      {
        expr: ["Equal", ["Add", ["Erf", 2], ["Erfc", 2]], 1],
        expected: "True",
        category: "Properties",
        caption: "Definition: $\\operatorname{erf}(z) + \\operatorname{erfc}(z) = 1$. See [[Erf]]",
      },
      {
        expr: ["Erfc", 1],
        expected: ["Erfc", 1],
        category: "Possible issues",
        caption:
          "An exact integer argument is left unevaluated under plain evaluation -- pair with N() or use an inexact argument like 0.5 for a decimal",
      },
      {
        expr: ["Erfc", 3.5],
        expected: { num: "7.43098372341412745524e-7" },
        category: "Neat examples",
        caption:
          "The Gaussian tail shrinks fast: only about $7\\times10^{-7}$ of the area lies beyond $3.5$ standard deviations",
      },
      {
        expr: ["Erfc", ["List", 0, 1]],
        expected: ["List", 1, ["Erfc", 1]],
        aspirational: true,
        category: "Scope",
        caption:
          "compute-engine's Erfc rejects a list argument outright with a type error (it does not thread over a list)",
      },
    ],
    seeAlso: ["Erf"],
  },
  {
    name: "ErfInv",
    domain: "Special functions",
    signature: "ErfInv(x)",
    summary:
      "The inverse error function: $\\operatorname{erfinv}(x)$ solves $\\operatorname{erf}(y) = x$ for $-1 < x < 1$.",
    signatures: [
      {
        call: "ErfInv(x)",
        description: "the inverse error function, solving $\\operatorname{erf}(y) = x$.",
      },
    ],
    details: [
      "Inverse of [[Erf]]: $\\operatorname{erf}(\\operatorname{erfinv}(x)) = x$.",
      "$\\operatorname{erfinv}(0) = 0$, and $\\operatorname{erfinv}(x) \\to \\pm\\infty$ as $x \\to \\pm 1$, the limits where Erf itself saturates.",
      "Computed by Newton's method on Erf itself, refining an initial approximation to full machine precision.",
      "Intrinsically ill-conditioned near $x = \\pm1$: a tiny change in x there produces a large change in the result.",
      "compute-engine leaves a call outside $[-1, 1]$ unevaluated rather than erroring or returning NaN.",
    ],
    examples: [
      { expr: ["ErfInv", 0], expected: 0 },
      { expr: ["ErfInv", 1], expected: "PositiveInfinity" },
      { expr: ["ErfInv", -1], expected: "NegativeInfinity" },
      {
        expr: ["ErfInv", 0.5],
        expected: { num: "0.476936276204469873381" },
        caption: "A floating-point argument evaluates directly to a high-precision decimal",
      },
      {
        expr: ["Equal", ["Erf", ["ErfInv", 0.5]], 0.5],
        expected: "True",
        category: "Properties",
        caption:
          "Inverse of Erf: $\\operatorname{erf}(\\operatorname{erfinv}(x)) = x$. See [[Erf]]",
      },
      {
        expr: ["ErfInv", 2],
        expected: ["ErfInv", 2],
        category: "Possible issues",
        caption:
          "Outside its real domain $[-1, 1]$, compute-engine leaves the call unevaluated rather than returning NaN or a complex value",
      },
      {
        expr: ["ErfInv", 0.9999],
        expected: { num: "2.75106390571206079615" },
        category: "Neat examples",
        caption: "Blows up near the boundary: $\\operatorname{erfinv}(0.9999)$ is already past 2.7",
      },
      {
        expr: ["ErfInv", ["List", 0, 1]],
        expected: ["List", 0, "PositiveInfinity"],
        aspirational: true,
        category: "Scope",
        caption:
          "compute-engine's InverseErf rejects a list argument outright with a type error (it does not thread over a list)",
      },
    ],
    seeAlso: ["Erf", "Erfc"],
  },
  {
    name: "Zeta",
    domain: "Special functions",
    signature: "Zeta(s)",
    // Irreducibly numeric: ζ evaluates, it does not rewrite into anything simpler. What it
    // HAS is four implementations in three environments, which is the more useful thing to
    // be able to see.
    primitive: "numeric",
    implementations: [
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/analytic/src/hurwitz-zeta.ts",
        note: "Riemann ζ is the m = 1 case of the Hurwitz implementation.",
      },
      {
        origin: "compiled",
        form: "wgsl",
        environment: "gpu",
        source: "packages/analytic/src/shader.ts:zetaWGSL",
        produces: "a colour per pixel — complex ζ, domain-coloured",
        note: "compute-engine's WGSLTarget has no lowering for Zeta (it fails closed), so the real-scalar GPU path falls back to CPU. `zetaWGSL` is used only by the complex-portrait fragment shader (complex-plot.ts), where Zeta(s) becomes clogPolar(hurwitz(s, vec2f(1,0))).",
      },
      {
        origin: "component",
        form: "<notatio-complex-plot>",
        environment: "browser",
        source: "packages/notatio-lit/src/notatio-complex-plot.ts",
        produces: "a rendered phase portrait",
        note: "For a plotted ζ the head's meaning bottoms out here: the element IS the answer, and there is no expression it reduces to.",
      },
      {
        origin: "mapped",
        form: "wolfram / sympy / mpmath / sage",
        environment: "external",
        source: "packages/oracle/src/mappings.ts",
        note: "Keyed by signature, not name: one argument is Riemann's, two is Hurwitz's, and the systems disagree about how to spell that.",
      },
    ],
    summary:
      "The Riemann zeta function $\\zeta(s) = \\sum_{n=1}^{\\infty} n^{-s}$ for $\\operatorname{Re}(s) > 1$, continued analytically elsewhere.",
    signatures: [
      { call: "Zeta(s)", description: "the Riemann zeta function $\\zeta(s)$." },
      {
        call: "Zeta(s, a)",
        description:
          "the two-argument generalized (Hurwitz-type) zeta $\\zeta(s, a)$; see [[HurwitzZeta]] for the difference.",
        library: "@enumeratio/analytic",
      },
    ],
    details: [
      "Even positive integers have closed forms in powers of $\\pi$: $\\zeta(2) = \\pi^2/6$ (the Basel problem), $\\zeta(4) = \\pi^4/90$, and so on.",
      "Trivial zeros at the negative even integers: $\\zeta(-2n) = 0$.",
      "Special values at nonpositive integers relate to the Bernoulli numbers: $\\zeta(-n) = -B_{n+1}/(n+1)$. See [[BernoulliB]].",
      "Pole at $s=1$: $\\zeta(1) = \\text{ComplexInfinity}$, reflecting the divergence of the harmonic series.",
      "Odd integers $\\geq 3$ (Apéry's constant $\\zeta(3)$, and beyond) have no known closed form and stay numeric-only.",
      "compute-engine reduces Zeta to an exact closed form at these special integer points -- even under plain evaluation, and even threaded over a list -- but leaves other reals, like $\\zeta(3)$, symbolic pending N().",
      "The two-argument form $\\zeta(s, a) = \\sum_{n\\geq 0} (n+a)^{-s}$ is provided by `@enumeratio/analytic` (compute-engine's built-in Zeta is single-argument). It equals [[HurwitzZeta]] for $\\operatorname{Re}(a) > 0$ but follows Wolfram's generalized-zeta convention for $a \\leq 0$: the terms off the positive axis use $((n+a)^2)^{-s/2}$ and the $n+a=0$ term is dropped, so $\\zeta(s, a)$ stays finite at $a = 0, -1, -2, \\dots$ -- in particular $\\zeta(s, 0) = \\zeta(s)$ -- where [[HurwitzZeta]] has poles.",
    ],
    examples: [
      { expr: ["Zeta", 2], expected: ["Multiply", ["Rational", 1, 6], ["Power", "Pi", 2]] },
      { expr: ["Zeta", 4], expected: ["Multiply", ["Rational", 1, 90], ["Power", "Pi", 4]] },
      { expr: ["Zeta", 6], expected: ["Multiply", ["Rational", 1, 945], ["Power", "Pi", 6]] },
      {
        expr: ["Zeta", ["List", -1, -2, -3]],
        expected: ["List", ["Rational", -1, 12], 0, ["Rational", 1, 120]],
        caption: "Threads over a list, reducing every element to its exact closed form",
      },
      {
        expr: ["Zeta", 0],
        expected: ["Rational", -1, 2],
        category: "Properties",
        caption: "$\\zeta(0) = -1/2$",
      },
      {
        expr: ["Zeta", -2],
        expected: 0,
        category: "Properties",
        caption: "Trivial zero: $\\zeta(-2n) = 0$ for positive integer n",
      },
      {
        expr: ["Zeta", -3],
        expected: ["Rational", 1, 120],
        category: "Properties",
        caption:
          "$\\zeta(-3) = -B_4/4 = 1/120$, via the Bernoulli-number relation. See [[BernoulliB]]",
      },
      {
        expr: ["Zeta", 1],
        expected: "ComplexInfinity",
        category: "Properties",
        caption: "Pole at $s=1$: the harmonic series $\\sum 1/n$ diverges",
      },
      {
        expr: ["Equal", ["Divide", 1, ["Zeta", 2]], ["Divide", 6, ["Power", "Pi", 2]]],
        expected: "True",
        category: "Applications",
        caption:
          "The probability that two random positive integers are coprime is $1/\\zeta(2) = 6/\\pi^2$",
      },
      {
        expr: ["Zeta", 3],
        expected: ["Zeta", 3],
        category: "Possible issues",
        caption:
          "Odd integers $\\geq 3$ have no known closed form (Apéry's constant, $\\zeta(3)$), so compute-engine leaves them symbolic under plain evaluation -- use N() for a decimal",
      },
      {
        expr: ["Zeta", -1],
        expected: ["Rational", -1, 12],
        category: "Neat examples",
        caption:
          'The notorious "sum of all positive integers" result from zeta-function regularization, $\\zeta(-1) = -1/12$',
      },
      {
        expr: ["Zeta", 2, 1],
        expected: ["Multiply", ["Rational", 1, 6], ["Power", "Pi", 2]],
        category: "Scope",
        caption:
          "Two-argument $\\zeta(s, a)$ (via `@enumeratio/analytic`): $\\zeta(s, 1) = \\zeta(s)$ recovers the ordinary case, so $\\zeta(2, 1) = \\pi^2/6$",
      },
      {
        expr: ["Zeta", 2, 2],
        expected: ["Add", -1, ["Multiply", ["Rational", 1, 6], ["Power", "Pi", 2]]],
        category: "Scope",
        caption: "$\\zeta(2, 2) = \\zeta(2) - 1 = \\pi^2/6 - 1$",
      },
      {
        expr: ["Zeta", 2, 0],
        expected: ["Multiply", ["Rational", 1, 6], ["Power", "Pi", 2]],
        category: "Scope",
        caption:
          "$\\zeta(s, 0) = \\zeta(s)$: the $n+a=0$ term is dropped, so unlike [[HurwitzZeta]] there is no pole at $a = 0$",
        divergence: {
          wolfram:
            "This matches Wolfram's $\\mathrm{Zeta}[s, a]$; Wolfram's $\\mathrm{HurwitzZeta}[s, 0]$ instead diverges (ComplexInfinity).",
        },
      },
    ],
    seeAlso: ["HurwitzZeta", "BernoulliB", "Gamma", "Digamma"],
  },
  {
    name: "HurwitzZeta",
    domain: "Special functions",
    signature: "HurwitzZeta(s, a)",
    summary:
      "The Hurwitz zeta function $\\zeta(s, a) = \\sum_{n=0}^{\\infty} (n+a)^{-s}$ for $\\operatorname{Re}(s) > 1$, continued analytically elsewhere. Provided by `@enumeratio/analytic`.",
    signatures: [
      {
        call: "HurwitzZeta(s, a)",
        description: "the Hurwitz zeta function $\\zeta(s, a)$.",
        library: "@enumeratio/analytic",
      },
    ],
    details: [
      "Generalizes the Riemann zeta: $\\zeta(s, 1) = \\zeta(s)$, and $\\zeta(s, m) = \\zeta(s) - \\sum_{k=1}^{m-1} k^{-s}$ for a positive integer $m$ (so $\\zeta(2, 2) = \\pi^2/6 - 1$).",
      "Nonpositive integer $s$: $\\zeta(-n, a) = -B_{n+1}(a)/(n+1)$, a Bernoulli polynomial in $a$ -- so $\\zeta(0, a) = \\tfrac12 - a$ and $\\zeta(-1, a) = -\\tfrac{1}{12}(6a^2 - 6a + 1)$. See [[BernoulliB]].",
      "Pole at $s = 1$: $\\zeta(1, a) = \\text{ComplexInfinity}$ for every $a$.",
      "Poles at $a = 0, -1, -2, \\dots$: the $(n+a)=0$ term is singular. (The two-argument [[Zeta]] drops that term instead, staying finite there.)",
      "Numeric evaluation (under N()) is Euler–Maclaurin summation and supports complex $s$ and $a$; it is aligned with Wolfram's $\\mathrm{HurwitzZeta}[s, a]$.",
    ],
    examples: [
      {
        expr: ["HurwitzZeta", 2, 1],
        expected: ["Multiply", ["Rational", 1, 6], ["Power", "Pi", 2]],
        caption: "$\\zeta(2, 1) = \\zeta(2) = \\pi^2/6$ -- reduces to the ordinary zeta",
      },
      {
        expr: ["HurwitzZeta", 2, 2],
        expected: ["Add", -1, ["Multiply", ["Rational", 1, 6], ["Power", "Pi", 2]]],
        caption: "$\\zeta(2, 2) = \\pi^2/6 - 1$",
      },
      {
        expr: ["HurwitzZeta", 0, "a"],
        expected: ["Add", ["Negate", "a"], ["Rational", 1, 2]],
        category: "Properties",
        caption: "$\\zeta(0, a) = \\tfrac12 - a$ -- exact and symbolic in $a$",
      },
      {
        expr: ["HurwitzZeta", -1, "a"],
        expected: [
          "Multiply",
          ["Rational", -1, 2],
          ["Add", ["Power", "a", 2], ["Negate", "a"], ["Rational", 1, 6]],
        ],
        category: "Properties",
        caption: "$\\zeta(-1, a) = -B_2(a)/2 = -\\tfrac{1}{12}(6a^2 - 6a + 1)$",
      },
      {
        expr: ["HurwitzZeta", 1, 3],
        expected: "ComplexInfinity",
        category: "Properties",
        caption: "Pole at $s = 1$ for every $a$",
      },
      {
        expr: ["HurwitzZeta", -3, ["Rational", 7, 3]],
        expected: ["Rational", -7813, 3240],
        category: "Possible issues",
        caption: "$\\zeta(-3, 7/3) = -B_4(7/3)/4 = -7813/3240$, exact via the Bernoulli polynomial",
        divergence: {
          wolfram:
            "Wolfram's $\\mathrm{FunctionExpand}$ and machine-precision $N$ agree ($-7813/3240$), but its arbitrary-precision $N[\\mathrm{HurwitzZeta}[-3, 7/3], 30]$ is wrong by $1/120$ (a Wolfram numeric-evaluation quirk at nonpositive-integer $s$ with rational $a$); mpmath agrees with us.",
        },
      },
    ],
    implementations: [
      {
        origin: "reference",
        form: "notatio",
        environment: "engine",
        expr: DEFINITIONS.HurwitzZeta,
        note: "The Dirichlet series, on the principal branch \u2014 written exp(\u2212s\u00b7ln(n+a)) so the wildcards arrive in the head's own order. It converges only for Re(s) > 1; everywhere else \u03b6(s, a) is its analytic continuation, which is what the kernel computes.",
      },
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/analytic/src/hurwitz-zeta.ts",
        note: "Euler\u2013Maclaurin in double precision \u2014 the fast path, and all a double holds. Asked for more digits than that, N() leaves it: at an integer s \u2265 2 with real a > 0 it takes \u03b6(n, a) = (\u22121)\u207f\u03c8\u207d\u207f\u207b\u00b9\u207e(a)/(n\u22121)! through compute-engine's PolyGamma, and otherwise (real s \u2260 1, real a > 0) it evaluates the SAME Euler\u2013Maclaurin written as an expression \u2014 a finite Sum over Power, Pochhammer and BernoulliB, which compute-engine carries to whatever precision was asked for (packages/analytic/src/precise.ts).",
      },
      {
        origin: "compiled",
        form: "wgsl",
        environment: "gpu",
        source: "packages/analytic/src/shader.ts:zetaWGSL",
        produces: "a colour per pixel \u2014 complex \u03b6(s, a), domain-coloured",
      },
      {
        origin: "mapped",
        form: "wolfram / mpmath",
        environment: "external",
        note: "HurwitzZeta[s, a]; mpmath.zeta(s, a).",
      },
    ],
    seeAlso: ["Zeta", "BernoulliB", "Gamma", "Digamma"],
  },
  {
    name: "LerchPhi",
    domain: "Special functions",
    signature: "LerchPhi(z, s, a)",
    summary:
      "The Lerch transcendent $\\Phi(z, s, a) = \\sum_{n=0}^{\\infty} \\dfrac{z^n}{(n+a)^s}$ — a common generalization of the polylogarithm and the Hurwitz zeta. Provided by `@enumeratio/analytic`.",
    signatures: [
      {
        call: "LerchPhi(z, s, a)",
        description: "the Lerch transcendent $\\Phi(z, s, a)$.",
        library: "@enumeratio/analytic",
      },
    ],
    details: [
      "At $z = 1$ it is the Hurwitz zeta: $\\Phi(1, s, a) = \\zeta(s, a)$, so $\\Phi(1, s, 1) = \\zeta(s)$. See [[HurwitzZeta]].",
      "It carries the polylogarithm: $\\operatorname{Li}_s(z) = z\\,\\Phi(z, s, 1)$ — e.g. $\\operatorname{Li}_2(1/2) = \\tfrac12\\Phi(1/2, 2, 1) = \\pi^2/12 - (\\ln 2)^2/2$.",
      "At $z = -1$ it is the Dirichlet eta: $\\Phi(-1, s, 1) = \\eta(s) = \\sum_{n\\ge1} (-1)^{n-1} n^{-s} = (1 - 2^{1-s})\\zeta(s)$, so $\\Phi(-1, 1, 1) = \\ln 2$.",
      "And the Dirichlet beta / Catalan's constant: $\\Phi(-1, 2, \\tfrac12) = 4\\beta(2) = 4G = 3.6638\\ldots$",
      "$\\Phi(z, 0, a) = 1/(1 - z)$ — the geometric series (and its continuation), independent of $a$, for all $z \\ne 1$.",
      "Convergence: the series converges for $|z| < 1$ (any $s$, $a$), and on $|z| = 1$ only for $\\operatorname{Re}(s) > 1$; elsewhere it is defined by analytic continuation in $z$.",
      "Poles at $a = 0, -1, -2, \\ldots$, from the singular $(n+a) = 0$ term, as for [[HurwitzZeta]].",
      "Numeric evaluation sums the series directly for $|z| < 1$ (geometric convergence), routes $z = 1$ through the Euler–Maclaurin Hurwitz kernel, and sums real $z < 0$ (the $z = -1$ rim included) by a van Wijngaarden Euler transform, so the alternating $\\eta(s)$ and Catalan cases reach machine precision. $|z| > 1$ is left unevaluated except where a closed form applies (e.g. $s = 0$).",
    ],
    examples: [
      {
        expr: ["LerchPhi", 1, 2, 1],
        expected: ["Multiply", ["Rational", 1, 6], ["Power", "Pi", 2]],
        caption: "$\\Phi(1, 2, 1) = \\zeta(2) = \\pi^2/6$ — reduces to the ordinary zeta",
      },
      {
        expr: ["LerchPhi", 1, 2, 2],
        expected: ["Add", -1, ["Multiply", ["Rational", 1, 6], ["Power", "Pi", 2]]],
        caption: "$\\Phi(1, 2, 2) = \\zeta(2, 2) = \\pi^2/6 - 1$",
      },
      {
        expr: ["LerchPhi", 1, 4, 1],
        expected: ["Multiply", ["Rational", 1, 90], ["Power", "Pi", 4]],
        category: "Properties",
        caption: "$\\Phi(1, 4, 1) = \\zeta(4) = \\pi^4/90$",
      },
      {
        expr: ["LerchPhi", 1, -1, 1],
        expected: ["Rational", -1, 12],
        category: "Properties",
        caption: "$\\Phi(1, -1, 1) = \\zeta(-1) = -1/12$",
        divergence: {
          wolfram:
            "At z = 1 compute-engine continues in s, giving ζ(-1) = -1/12; Wolfram's LerchPhi does not regularise the divergent series at z = 1 and returns ComplexInfinity (though its Zeta[-1] does).",
        },
      },
      {
        expr: ["LerchPhi", 1, "s", "a"],
        expected: ["HurwitzZeta", "s", "a"],
        category: "Properties",
        caption: "$\\Phi(1, s, a) = \\zeta(s, a)$ for symbolic $s$, $a$",
      },
      {
        expr: ["LerchPhi", "z", 0, "a"],
        expected: ["Divide", 1, ["Add", ["Negate", "z"], 1]],
        category: "Properties",
        caption: "$\\Phi(z, 0, a) = 1/(1 - z)$, independent of $a$",
      },
      {
        expr: ["LerchPhi", 2, 0, 7],
        expected: -1,
        category: "Properties",
        caption:
          "$\\Phi(2, 0, 7) = 1/(1 - 2) = -1$: the $s = 0$ closed form holds past the unit disk",
      },
      {
        expr: ["Equal", ["LerchPhi", 1, 3, 1], ["Zeta", 3]],
        expected: "True",
        category: "Applications",
        caption: "$\\Phi(1, 3, 1) = \\zeta(3)$, Apéry's constant",
      },
      {
        expr: ["Equal", ["LerchPhi", -1, 2, 1], ["Divide", ["Power", "Pi", 2], 12]],
        expected: "True",
        category: "Applications",
        caption:
          "$\\Phi(-1, 2, 1) = \\eta(2) = \\pi^2/12$ — the alternating rim, via the Euler transform",
      },
    ],
    implementations: [
      {
        origin: "reference",
        form: "notatio",
        environment: "engine",
        expr: DEFINITIONS.LerchPhi,
        note: "The defining series, converging for |z| < 1 (and for |z| = 1 with Re(s) > 1); \u03b6(s, a) is its z = 1 edge and Li_s(z) its a = 1 slice.",
      },
      {
        origin: "native",
        form: "typescript",
        environment: "engine",
        source: "packages/analytic/src/lerch.ts",
        note: "The direct series, which covers |z| \u2264 1; z = 1 hands off to HurwitzZeta and inherits its closed forms.",
      },
      {
        origin: "compiled",
        form: "wgsl",
        environment: "gpu",
        source: "packages/analytic/src/shader.ts:zetaWGSL",
        produces: "a colour per pixel \u2014 complex \u03a6, domain-coloured",
      },
      {
        origin: "mapped",
        form: "wolfram / mpmath",
        environment: "external",
        note: "LerchPhi[z, s, a]; mpmath.lerchphi(z, s, a).",
      },
    ],
    seeAlso: ["HurwitzZeta", "Zeta", "Gamma", "PolyLog"],
  },
  {
    name: "PolyLog",
    domain: "Special functions",
    signature: "PolyLog(s, z)",
    summary:
      "The polylogarithm $\\operatorname{Li}_s(z) = \\sum_{n=1}^{\\infty} \\dfrac{z^n}{n^s}$, the $a = 1$ slice of the Lerch transcendent.",
    signatures: [
      {
        call: "PolyLog(s, z)",
        description: "the polylogarithm $\\operatorname{Li}_s(z)$ at integer order $s$.",
      },
      {
        call: "PolyLog(s, z)",
        description:
          "extends the same call to non-integer and complex order $s$, for $|z| \\leq 1$.",
        library: "@enumeratio/analytic",
      },
    ],
    details: [
      "$\\operatorname{Li}_s(z) = z\\,\\Phi(z, s, 1)$ in terms of the Lerch transcendent — see [[LerchPhi]], which is how the non-integer orders are computed.",
      "$\\operatorname{Li}_s(1) = \\zeta(s)$: the ordinary zeta lives on the $z = 1$ edge. See [[Zeta]].",
      "Low orders are elementary: $\\operatorname{Li}_0(z) = z/(1-z)$, $\\operatorname{Li}_1(z) = -\\ln(1-z)$, $\\operatorname{Li}_{-1}(z) = z/(1-z)^2$, and every negative integer order is a rational function.",
      "The dilogarithm $\\operatorname{Li}_2$ has the special values $\\operatorname{Li}_2(1) = \\pi^2/6$, $\\operatorname{Li}_2(-1) = -\\pi^2/12$, and $\\operatorname{Li}_2(\\tfrac12) = \\pi^2/12 - (\\ln 2)^2/2$.",
      "Convergence: the series converges for $|z| < 1$, and on $|z| = 1$ for $\\operatorname{Re}(s) > 1$. Outside the disk the function continues analytically, with a branch cut along $[1, \\infty)$ — so $\\operatorname{Li}_2(2) = \\pi^2/4 - i\\pi\\ln 2$ is complex.",
      "Integer orders (including the continuation past $|z| = 1$) are compute-engine's own. `@enumeratio/analytic` adds non-integer and complex $s$ by summing the Lerch series, which reaches $|z| \\leq 1$ only; outside that disk a non-integer order is left unevaluated rather than guessed.",
      "As with the other numeric heads, an exact argument stays symbolic under plain evaluation — pair with N(), or pass an inexact argument.",
    ],
    examples: [
      {
        expr: ["PolyLog", 2, 1],
        expected: ["Multiply", ["Rational", 1, 6], ["Power", "Pi", 2]],
        caption: "$\\operatorname{Li}_2(1) = \\zeta(2) = \\pi^2/6$",
      },
      {
        expr: ["PolyLog", 2, -1],
        expected: ["Multiply", ["Rational", -1, 12], ["Power", "Pi", 2]],
        caption: "$\\operatorname{Li}_2(-1) = -\\eta(2) = -\\pi^2/12$",
      },
      {
        expr: ["PolyLog", 4, 1],
        expected: ["Multiply", ["Rational", 1, 90], ["Power", "Pi", 4]],
        caption: "$\\operatorname{Li}_4(1) = \\zeta(4) = \\pi^4/90$",
      },
      {
        expr: ["PolyLog", 1, "z"],
        expected: ["Negate", ["Ln", ["Add", ["Negate", "z"], 1]]],
        category: "Properties",
        caption: "$\\operatorname{Li}_1(z) = -\\ln(1 - z)$, symbolically",
      },
      {
        expr: ["PolyLog", -1, "z"],
        expected: ["Divide", "z", ["Power", ["Add", ["Negate", "z"], 1], 2]],
        category: "Properties",
        caption: "$\\operatorname{Li}_{-1}(z) = z/(1-z)^2$ — negative orders are rational",
      },
      {
        expr: [
          "Equal",
          ["Add", ["PolyLog", 2, 0.5], ["Multiply", 0.5, ["Power", ["Ln", 2], 2]]],
          ["Divide", ["Power", "Pi", 2], 12],
        ],
        expected: "True",
        category: "Properties",
        caption: "$\\operatorname{Li}_2(1/2) = \\pi^2/12 - (\\ln 2)^2/2$",
      },
      {
        expr: ["PolyLog", 0.5, 1],
        expected: { num: "-1.46035450880958681289" },
        category: "Applications",
        caption:
          "$\\operatorname{Li}_{1/2}(1) = \\zeta(1/2)$ — a non-integer order, from `@enumeratio/analytic`",
        divergence: {
          wolfram:
            "Li_{1/2}(1): compute-engine continues in s to ζ(1/2); Wolfram treats z = 1 as the branch point for s ≤ 1 and returns ComplexInfinity.",
        },
      },
      {
        expr: ["PolyLog", 0.5, 0.5],
        expected: 0.8061267230428522,
        category: "Applications",
        caption: "$\\operatorname{Li}_{1/2}(1/2) = 0.80612672\\ldots$, via the Lerch series",
      },
      {
        expr: ["PolyLog", 2.5, -0.5],
        expected: -0.46229778219006346,
        category: "Applications",
        caption:
          "$\\operatorname{Li}_{5/2}(-1/2) = -0.46229778\\ldots$ — the alternating side, Euler-transformed",
      },
      {
        expr: ["PolyLog", 2, ["List", 0.5, 0.25]],
        expected: ["List", 0.5822405264650125, 0.2676526390827325],
        category: "Scope",
        caption: "Threads over a list of arguments",
      },
      {
        expr: ["PolyLog", 2.5, 2],
        expected: ["PolyLog", 2.5, 2],
        category: "Possible issues",
        caption:
          "A non-integer order past $|z| = 1$ is left unevaluated: the series does not reach there and the continuation is only implemented for integer $s$",
        divergence: {
          wolfram:
            "Wolfram's $\\mathrm{PolyLog}[5/2, 2]$ continues to a complex value; we return the expression unevaluated rather than a wrong number.",
        },
      },
      {
        expr: ["PolyLog", 2, ["Rational", 1, 2]],
        expected: ["PolyLog", 2, ["Rational", 1, 2]],
        category: "Possible issues",
        caption:
          "An exact argument stays symbolic under plain evaluation -- pair with N() or pass 0.5 instead",
      },
    ],
    seeAlso: ["LerchPhi", "Zeta", "HurwitzZeta", "Ln"],
  },
  {
    name: "PolyGamma",
    domain: "Special functions",
    signature: "PolyGamma(m, z)",
    summary:
      "The polygamma function $\\psi^{(m)}(z) = \\dfrac{d^{m+1}}{dz^{m+1}} \\ln\\Gamma(z)$, the $m$-th derivative of the digamma.",
    signatures: [
      {
        call: "PolyGamma(m, z)",
        description: "the polygamma $\\psi^{(m)}(z)$ at real $z$.",
      },
      {
        call: "PolyGamma(m, z)",
        description: "extends the same call to complex $z$, for integer order $m \\geq 1$.",
        library: "@enumeratio/analytic",
      },
    ],
    details: [
      "$\\psi^{(0)}$ is the digamma — see [[Digamma]] — and $\\psi^{(1)}$ the trigamma.",
      "For $m \\geq 1$ it is a Hurwitz zeta in disguise: $\\psi^{(m)}(z) = (-1)^{m+1}\\, m!\\, \\zeta(m+1, z)$. See [[HurwitzZeta]].",
      "So at $z = 1$ every order is a zeta value: $\\psi^{(m)}(1) = (-1)^{m+1} m!\\, \\zeta(m+1)$, giving $\\psi'(1) = \\pi^2/6$ and $\\psi''(1) = -2\\zeta(3)$.",
      "Half-integer arguments pick up the alternating zeta: $\\psi'(\\tfrac12) = \\pi^2/2$.",
      "Recurrence from $\\Gamma$: $\\psi^{(m)}(z+1) = \\psi^{(m)}(z) + (-1)^m m!\\, z^{-m-1}$, so $\\psi'(1) - \\psi'(2) = 1$.",
      "Poles at the nonpositive integers, of order $m+1$ — the poles of [[Gamma]], differentiated.",
      "Real $z$ is compute-engine's own; `@enumeratio/analytic` adds complex $z$ through the Euler–Maclaurin Hurwitz kernel, and the WGSL lowering for GPU plotting.",
    ],
    examples: [
      {
        expr: ["Equal", ["PolyGamma", 1, 1], ["Zeta", 2]],
        expected: "True",
        caption: "$\\psi'(1) = \\zeta(2) = \\pi^2/6$",
      },
      {
        expr: ["Equal", ["PolyGamma", 2, 1], ["Multiply", -2, ["Zeta", 3]]],
        expected: "True",
        caption: "$\\psi''(1) = -2\\zeta(3)$, Apéry's constant doubled and negated",
      },
      {
        expr: ["Equal", ["PolyGamma", 1, ["Rational", 1, 2]], ["Divide", ["Power", "Pi", 2], 2]],
        expected: "True",
        category: "Properties",
        caption: "$\\psi'(1/2) = \\pi^2/2$",
      },
      {
        expr: ["Equal", ["Subtract", ["PolyGamma", 1, 1], ["PolyGamma", 1, 2]], 1],
        expected: "True",
        category: "Properties",
        caption: "Recurrence at $m = 1$, $z = 1$: $\\psi'(z) - \\psi'(z+1) = z^{-2}$",
      },
      {
        expr: ["PolyGamma", 1, 0.5],
        expected: { num: "4.93480220054467930942" },
        caption: "An inexact argument evaluates to a decimal: $\\psi'(1/2) = 4.93480\\ldots$",
      },
      {
        expr: ["PolyGamma", 1, 0],
        expected: "ComplexInfinity",
        caption: "A pole of Gamma, still a pole after differentiating",
      },
      {
        expr: ["N", ["PolyGamma", 1, ["Complex", 1, 1]]],
        expected: ["Complex", 0.46300009662276376, -0.794233542759319],
        category: "Applications",
        caption:
          "$\\psi'(1+i) = 0.46300\\ldots - 0.79423\\ldots i$ — complex argument, from `@enumeratio/analytic`",
      },
      {
        expr: ["PolyGamma", 1, ["List", 1, 2]],
        expected: ["List", ["PolyGamma", 1, 1], ["PolyGamma", 1, 2]],
        category: "Scope",
        caption: "Threads over a list (each element exact, so each stays symbolic)",
      },
      {
        expr: ["PolyGamma", 1, 1],
        expected: ["PolyGamma", 1, 1],
        category: "Possible issues",
        caption:
          "An exact integer argument is left unevaluated under plain evaluation -- pair with N() or use an inexact argument",
      },
    ],
    seeAlso: ["Digamma", "Gamma", "HurwitzZeta", "Zeta"],
  },
  {
    name: "Digamma",
    domain: "Special functions",
    signature: "Digamma(z)",
    summary:
      "The digamma function $\\psi(z) = \\dfrac{d}{dz}\\ln\\Gamma(z)$, the logarithmic derivative of [[Gamma]].",
    signatures: [
      {
        call: "Digamma(z)",
        description: "the digamma function $\\psi(z) = \\Gamma'(z)/\\Gamma(z)$.",
      },
    ],
    details: [
      "Digamma is the order-zero polygamma: $\\psi(z) = \\psi^{(0)}(z)$. The higher derivatives are [[PolyGamma]].",
      "$\\psi(1) = -\\gamma$, the negative Euler-Mascheroni constant.",
      "Recurrence inherited from Gamma's functional equation: $\\psi(z+1) = \\psi(z) + 1/z$.",
      "$\\psi(1/2) = -\\gamma - 2\\ln 2$.",
      "Poles at the nonpositive integers, the same poles as [[Gamma]].",
      "compute-engine reduces Digamma to a numeric value only via N() or an inexact argument; exact integer or rational arguments stay symbolic under plain evaluation except at the poles.",
    ],
    examples: [
      {
        expr: ["Digamma", 0],
        expected: "ComplexInfinity",
        caption: "A pole of Gamma, shared by its log-derivative",
      },
      { expr: ["Digamma", -1], expected: "ComplexInfinity" },
      {
        expr: ["Digamma", 0.5],
        expected: { num: "-1.96351002602142347944" },
        caption: "A floating-point argument evaluates directly to a high-precision decimal",
      },
      {
        expr: ["Equal", ["Add", ["Digamma", 1], "EulerGamma"], 0],
        expected: "True",
        category: "Properties",
        caption: "$\\psi(1) = -\\gamma$",
      },
      {
        expr: ["Equal", ["Digamma", 2], ["Add", ["Digamma", 1], 1]],
        expected: "True",
        category: "Properties",
        caption: "Recurrence: $\\psi(z+1) = \\psi(z) + 1/z$, here at $z = 1$",
      },
      {
        expr: [
          "Equal",
          ["Add", ["Digamma", ["Rational", 1, 2]], "EulerGamma", ["Multiply", 2, ["Ln", 2]]],
          0,
        ],
        expected: "True",
        category: "Properties",
        caption: "$\\psi(1/2) = -\\gamma - 2\\ln 2$",
      },
      {
        expr: [
          "Equal",
          ["Add", ["Digamma", 6], "EulerGamma"],
          [
            "Add",
            1,
            ["Rational", 1, 2],
            ["Rational", 1, 3],
            ["Rational", 1, 4],
            ["Rational", 1, 5],
          ],
        ],
        expected: "True",
        category: "Applications",
        caption: "Harmonic numbers via Digamma: $\\psi(n+1) + \\gamma = H_n$, here $H_5$ at $n=5$",
      },
      {
        expr: ["Digamma", 1],
        expected: ["Digamma", 1],
        category: "Possible issues",
        caption:
          "An exact integer argument is left unevaluated under plain evaluation -- pair with N() or use an inexact argument like 0.5 for a decimal",
      },
      {
        expr: ["Digamma", -0.5],
        expected: { num: "0.036489973978576520559" },
        category: "Neat examples",
        caption:
          "Between the poles at 0 and -1, $\\psi$ is still finite: $\\psi(-1/2) \\approx 0.036$",
      },
      {
        expr: ["Digamma", ["List", 1, 2, 3]],
        expected: [
          "List",
          ["Negate", "EulerGamma"],
          ["Subtract", 1, "EulerGamma"],
          ["Subtract", ["Rational", 3, 2], "EulerGamma"],
        ],
        aspirational: true,
        category: "Scope",
        caption:
          "Integer arguments should reduce to closed forms in $\\gamma$; currently each element is left symbolic",
      },
    ],
    seeAlso: ["Gamma", "Zeta", "GammaLn"],
  },
  {
    name: "GammaRegularized",
    domain: "Special functions",
    signature: "GammaRegularized(a, z)",
    summary:
      "The regularized upper incomplete gamma function $Q(a, z) = \\Gamma(a, z)/\\Gamma(a)$, the survival function of the Gamma(a, 1) distribution.",
    signatures: [
      {
        call: "GammaRegularized(a, z)",
        description: "the regularized upper incomplete gamma $Q(a, z) = \\Gamma(a, z)/\\Gamma(a)$.",
      },
      {
        call: "GammaRegularized(a, z0, z1)",
        description:
          "the regularized difference $(\\Gamma(a, z_0) - \\Gamma(a, z_1))/\\Gamma(a)$; at $z_0 = 0$ the LOWER regularized $P(a, z_1) = 1 - Q(a, z_1)$.",
        library: "@enumeratio/analytic",
      },
    ],
    details: [
      "Complementary to the lower regularized $P(a, z) = 1 - Q(a, z)$, which is the three-argument $Q(a, 0, z)$ (`@enumeratio/analytic`) -- the Gamma-distribution CDF, and with $a = k/2$, $z = x/2$ the $\\chi^2_k$ CDF.",
      "$Q(a, 0) = 1$ for any $a > 0$: all the mass sits to the right of 0.",
      "For a positive integer n it has a closed polynomial form, $Q(n, z) = e^{-z}\\sum_{k=0}^{n-1} z^k/k!$, which compute-engine uses to evaluate exactly, even for negative z.",
      "Gives the Poisson CDF tail and the Gamma-distribution survival function, so it shows up throughout reliability and queueing models. See [[Gamma]].",
      "compute-engine leaves a non-integer a combined with negative z symbolic -- genuinely outside the real domain there -- rather than erroring or returning NaN.",
      "The three-argument form divides the difference by $\\Gamma(a)$ rather than subtracting two $Q$ values, so $Q(a, 0, z) = 1 - Q(a, z)$ holds for negative $a$ too, where $\\Gamma(a, 0)$ and $\\Gamma(a)$ are separately infinite but their ratio is 1. That is Wolfram's convention.",
      "A genuinely complex $a$ or $z$, which the built-in handler declines, is evaluated as $\\Gamma(a, z)/\\Gamma(a)$ (`@enumeratio/analytic`) -- [[Gamma]] itself takes complex arguments.",
    ],
    examples: [
      { expr: ["GammaRegularized", 1, 0], expected: 1, caption: "$Q(a, 0) = 1$ for any $a$" },
      {
        expr: ["GammaRegularized", 1, 1],
        expected: ["Divide", 1, "ExponentialE"],
        caption: "$Q(1, z) = e^{-z}$, here at $z = 1$",
      },
      {
        expr: ["GammaRegularized", 2.5, 1.5],
        expected: { num: "0.6999858358786275091" },
        caption: "Floating-point arguments evaluate directly to a high-precision decimal",
      },
      {
        expr: ["GammaRegularized", 5, -1],
        expected: ["Multiply", ["Rational", 3, 8], "ExponentialE"],
        category: "Properties",
        caption:
          "The polynomial closed form for an integer order extends validly to negative $z$ too, following the analytic continuation",
      },
      {
        expr: ["GammaRegularized", 3, 2],
        expected: ["Divide", 5, ["Power", "ExponentialE", 2]],
        category: "Applications",
        caption: "The CDF of a Poisson($\\lambda=2$) random variable at $k=2$ is $Q(3, 2) = 5/e^2$",
      },
      {
        expr: ["GammaRegularized", 2.5, -1],
        expected: ["GammaRegularized", 2.5, -1],
        category: "Possible issues",
        caption:
          "A non-integer order combined with negative z falls outside the real domain; compute-engine leaves it symbolic rather than erroring or returning NaN",
        divergence: {
          wolfram:
            "A non-integer order with negative z is left symbolic here (real domain only); Wolfram continues into the complex plane.",
        },
      },
      {
        expr: ["GammaRegularized", 2.5, 0, 1.5],
        expected: 0.30001416412137194,
        category: "Applications",
        caption:
          "Three arguments: $P(5/2, 3/2) = Q(5/2, 0, 3/2)$, the Gamma(5/2, 1) distribution's CDF at $3/2$",
      },
      {
        expr: ["GammaRegularized", -1.5, 0, 1.5],
        expected: 0.9852600743603472,
        category: "Properties",
        caption:
          "$Q(a, 0, z) = 1 - Q(a, z)$ even for negative $a$, where $\\Gamma(a, 0)$ and $\\Gamma(a)$ are each infinite but their ratio is 1",
      },
      {
        expr: ["GammaRegularized", ["List", 1, 2], 1],
        expected: ["List", ["Divide", 1, "ExponentialE"], ["Divide", 2, "ExponentialE"]],
        aspirational: true,
        category: "Scope",
        caption:
          "compute-engine's GammaRegularized rejects a list argument outright with a type error (it does not thread over a list)",
      },
    ],
    seeAlso: ["Gamma", "BetaRegularized"],
  },
  {
    name: "BetaRegularized",
    domain: "Special functions",
    signature: "BetaRegularized(x, a, b)",
    summary:
      "The regularized incomplete beta function $I_x(a, b)$, the CDF of the Beta(a, b) distribution and a bridge to the binomial CDF.",
    signatures: [
      {
        call: "BetaRegularized(x, a, b)",
        description: "the regularized incomplete beta function $I_x(a, b)$.",
      },
    ],
    details: [
      "Normalized against [[Beta]]: $I_x(a, b)$ is the incomplete beta integral at x, divided by $B(a, b)$, so $I_0(a,b)=0$ and $I_1(a,b)=1$.",
      "Symmetry: $I_x(a, b) + I_{1-x}(b, a) = 1$.",
      "Ties to the binomial CDF: for $X \\sim \\text{Binomial}(n, p)$, $P(X \\leq k) = I_{1-p}(n-k, k+1)$.",
      "By symmetry, $I_{1/2}(a, a) = 1/2$ for any a: a symmetric Beta(a, a) distribution has its median exactly at the midpoint.",
      "compute-engine leaves x outside $[0, 1]$ symbolic rather than erroring or returning NaN.",
    ],
    examples: [
      { expr: ["BetaRegularized", 0, 2, 3], expected: 0 },
      { expr: ["BetaRegularized", 1, 2, 3], expected: 1 },
      {
        expr: ["BetaRegularized", 0.5, 2, 3],
        expected: 0.6875,
        caption: "A floating-point x evaluates directly to a decimal",
      },
      {
        expr: ["BetaRegularized", 0.5, 1, 1],
        expected: 0.5,
        caption: "$I_x(1, 1) = x$, the uniform distribution's own CDF",
      },
      {
        expr: ["Equal", ["Add", ["BetaRegularized", 0.3, 2, 3], ["BetaRegularized", 0.7, 3, 2]], 1],
        expected: "True",
        category: "Properties",
        caption: "Symmetry: $I_x(a, b) + I_{1-x}(b, a) = 1$",
      },
      {
        expr: ["BetaRegularized", 0.5, 10, 10],
        expected: 0.5,
        category: "Properties",
        caption: "$I_{1/2}(a, a) = 1/2$ for any a, here at $a = 10$",
      },
      {
        expr: [
          "Equal",
          ["BetaRegularized", 0.7, 3, 2],
          ["Add", ["Power", 0.7, 4], ["Multiply", 4, 0.3, ["Power", 0.7, 3]]],
        ],
        expected: "True",
        category: "Applications",
        caption:
          "Binomial CDF via the regularized beta: for $X \\sim \\text{Binomial}(4, 0.3)$, $P(X \\leq 1) = I_{0.7}(3, 2)$",
      },
      {
        expr: ["BetaRegularized", 2, 2, 3],
        expected: ["BetaRegularized", 2, 2, 3],
        category: "Possible issues",
        caption: "An x outside $[0, 1]$ is left unevaluated rather than erroring or returning NaN",
        divergence: {
          wolfram:
            "x outside [0, 1] is left unevaluated here; Wolfram continues the regularised incomplete beta function and gets 8.",
        },
      },
      {
        expr: ["BetaRegularized", 0.5, ["List", 1, 2], 1],
        expected: ["List", 0.5, 0.25],
        aspirational: true,
        category: "Scope",
        caption:
          "compute-engine's BetaRegularized rejects a list argument outright with a type error (it does not thread over a list)",
      },
    ],
    seeAlso: ["Beta", "GammaRegularized", "Binomial"],
  },
];
