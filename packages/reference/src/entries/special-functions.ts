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
// entries below call this out explicitly. Gamma and Digamma are overridden past
// that policy at the integers and half-integers (`@enumeratio/analytic`), reusing
// `gammaExact`/`HarmonicNumber` -- see their entries below.
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
      "compute-engine's plain evaluation would otherwise leave Gamma at exact integer or rational arguments unevaluated (`@enumeratio/analytic` overrides it, reducing every integer and half-integer exactly); a floating-point argument, or N(), still reduces to a decimal.",
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
        expr: ["Equal", ["Power", ["Gamma", ["Rational", 1, 2]], 2], "Pi"],
        expected: "True",
        category: "Neat examples",
        caption:
          "Squaring the reflection formula at $z=1/2$ collapses it to $\\Gamma(1/2)^2 = \\pi$",
      },
      {
        expr: ["Gamma", ["List", 1, 2, 3, 4, 5]],
        expected: ["List", 1, 1, 2, 6, 24],
        category: "Scope",
        caption:
          "Threads over a list and reduces each integer argument to the concrete factorial, overriding compute-engine's plain policy of leaving exact Gamma arguments symbolic",
      },
      {
        expr: ["Gamma", ["Rational", 5, 2]],
        expected: ["Multiply", ["Rational", 3, 4], ["Sqrt", "Pi"]],
        category: "Scope",
        caption: "$\\Gamma(5/2) = \\frac{3}{4}\\sqrt{\\pi}$, via the half-integer recurrence",
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
        expected: [
          "Add",
          ["Negate", ["Multiply", ["Add", "z", 1], ["Power", "ExponentialE", ["Negate", "z"]]]],
          1,
        ],
        category: "Properties",
        caption:
          "Now that $\\Gamma(2, z)$ has a closed form, the three-argument difference reduces through it too: $\\Gamma(2, 0, z) = 1 - (1+z)e^{-z}$. Wolfram's bare `Gamma[2, 0, z]` stays unevaluated (only `FunctionExpand` reaches this); this engine reduces both",
      },
      {
        expr: ["Gamma", 4.5],
        expected: { num: "11.6317283965674489291" },
        caption: "A machine-precision argument: $\\Gamma(4.5) = 11.6317\\ldots$",
      },
      {
        expr: ["Gamma", 5],
        expected: 24,
        caption: "$\\Gamma(5) = 4! = 24$",
      },
      {
        expr: ["Gamma", ["Complex", 2.3, 1]],
        expected: ["Complex", 0.7191409365372811, 0.5406144679098487],
        category: "Scope",
        caption: "Complex arguments evaluate directly",
      },
      {
        expr: ["Gamma", ["Rational", 7, 2]],
        expected: ["Multiply", ["Rational", 15, 8], ["Sqrt", "Pi"]],
        category: "Scope",
        caption: "Half-integers have closed forms: $\\Gamma(7/2) = \\frac{15}{8}\\sqrt{\\pi}$",
      },
      {
        expr: ["Gamma", ["Rational", -3, 2]],
        expected: ["Multiply", ["Rational", 4, 3], ["Sqrt", "Pi"]],
        category: "Scope",
        caption: "...including negative half-integers: $\\Gamma(-3/2) = \\frac{4}{3}\\sqrt{\\pi}$",
      },
      {
        expr: ["Gamma", "PositiveInfinity"],
        expected: "PositiveInfinity",
        category: "Scope",
        caption: "$\\Gamma(\\infty) = \\infty$",
      },
      {
        expr: ["Gamma", 200.5],
        expected: { num: "5.57316894480137913364e+373" },
        category: "Scope",
        caption:
          "Values far past the double range: $\\Gamma(200.5) \\approx 5.57 \\times 10^{373}$",
      },
      {
        expr: ["Gamma", 2.5, 1.5],
        expected: 0.9305194427867931,
        category: "Scope",
        caption: "Two arguments: the upper incomplete gamma $\\Gamma(5/2, 3/2)$",
      },
      {
        expr: ["Gamma", 2, "x"],
        expected: ["Multiply", ["Add", "x", 1], ["Power", "ExponentialE", ["Negate", "x"]]],
        category: "Scope",
        caption: "An integer order reduces to a closed form: $\\Gamma(2, x) = (1 + x)e^{-x}$",
      },
      {
        expr: ["Gamma", 2, 1],
        expected: ["Divide", 2, "ExponentialE"],
        category: "Scope",
        caption: "$\\Gamma(2, 1) = 2/e$, the same closed form at an exact argument",
      },
      {
        expr: [
          "Gamma",
          2,
          ["List", ["List", ["Rational", 7, 2], 0], ["List", 0, ["Rational", 13, 2]]],
        ],
        expected: [
          "List",
          [
            "List",
            ["Divide", 9, ["Multiply", 2, ["Power", "ExponentialE", ["Rational", 7, 2]]]],
            1,
          ],
          [
            "List",
            1,
            ["Divide", 15, ["Multiply", 2, ["Power", "ExponentialE", ["Rational", 13, 2]]]],
          ],
        ],
        category: "Scope",
        caption:
          "Listable: threads elementwise over a matrix, and each entry reduces ($\\Gamma(2, 0) = 1$)",
      },
      {
        expr: ["Gamma", ["Interval", 1.4, 1.5]],
        expected: ["Interval", 0.8856031944108887, 0.8872638175030753],
        aspirational: true,
        category: "Scope",
        caption:
          "Interval arithmetic: the image of $[1.4, 1.5]$, whose lower end is $\\Gamma$'s minimum at $x_0 = 1.4616\\ldots$; not yet",
      },
      {
        expr: ["Gamma", ["Around", 2.5, 0.01]],
        expected: ["Around", 1.329340388179137, 0.009347345216260856],
        aspirational: true,
        category: "Scope",
        caption:
          "Uncertainty propagation: $\\Gamma(2.5 \\pm 0.01) = 1.3293 \\pm 0.0093$; `Around` is not declared",
      },
      {
        expr: ["Gamma", "a", 0],
        expected: ["Gamma", "a"],
        category: "Properties",
        caption: "$\\Gamma(a, 0) = \\Gamma(a)$: the incomplete gamma from zero is the complete one",
      },
      {
        expr: ["Gamma", 0, 1.5],
        expected: 0.10001958240663252,
        category: "Properties",
        caption: "$\\Gamma(0, z) = E_1(z)$, the exponential integral: $E_1(3/2) = 0.10002\\ldots$",
      },
      {
        expr: ["Gamma", ["Rational", 1, 2], "x"],
        expected: ["Multiply", ["Erfc", ["Sqrt", "x"]], ["Sqrt", "Pi"]],
        category: "Properties",
        caption: "$\\Gamma(1/2, x) = \\sqrt{\\pi}\\,\\operatorname{erfc}(\\sqrt{x})$. See [[Erfc]]",
      },
      {
        expr: ["Divide", ["D", ["Gamma", "x"], "x"], ["Gamma", "x"]],
        expected: ["Digamma", "x"],
        category: "Properties",
        caption:
          "$\\Gamma'(x) = \\Gamma(x)\\,\\psi(x)$, so the logarithmic derivative is [[Digamma]]",
      },
      {
        expr: ["N", ["Power", ["Abs", ["Gamma", "ImaginaryUnit"]], 2]],
        expected: { num: "0.272029054982132823542" },
        category: "Neat examples",
        caption: "$|\\Gamma(i)|^2 = \\pi/\\sinh\\pi = 0.27203\\ldots$",
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
        expected: ["Add", ["Multiply", 3, ["Ln", 2]], ["Ln", 3]],
        category: "Properties",
        caption:
          "An exact positive integer now reduces too, matching Wolfram's LogGamma[5] = Log[24] ($\\ln 24 = 3\\ln 2 + \\ln 3$, compute-engine's own factored form for $\\ln$ of a composite)",
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
        expected: "PositiveInfinity",
        category: "Scope",
        divergence: {
          wolfram:
            "Wolfram's GammaLn[-1] is ComplexInfinity, the complex-analytic reading of a pole of Gamma.",
        },
        caption:
          "At a pole of Gamma, compute-engine gives the real log-magnitude's divergence, PositiveInfinity, rather than treating GammaLn as complex-analytic",
      },
      {
        expr: ["GammaLn", 100.5],
        expected: { num: "361.435540467777621555" },
        caption: "$\\ln\\Gamma(100.5)$, where $\\Gamma(100.5)$ itself is about $10^{157}$",
      },
      {
        expr: ["GammaLn", ["Complex", 2.5, 3]],
        expected: ["Complex", -1.4709546103488425, 2.8226156382608],
        category: "Scope",
        caption:
          "Complex arguments; here the principal $\\ln\\Gamma(z)$ and Wolfram's $\\mathrm{LogGamma}$ agree, as the imaginary part stays inside $(-\\pi, \\pi]$",
      },
      {
        expr: ["GammaLn", { num: "1e1000" }],
        expected: { num: "2.30158509299404568402e+1003" },
        aspirational: true,
        category: "Scope",
        caption:
          "A huge inexact argument should still evaluate (Stirling's series): $\\ln\\Gamma(10^{1000}) \\approx 2.3016 \\times 10^{1003}$; left unevaluated today",
      },
      {
        expr: ["GammaLn", ["List", 1, 2, 3]],
        expected: ["List", 0, 0, ["Ln", 2]],
        category: "Scope",
        caption:
          "Threads over a list, and the integer points reduce to $\\ln((n-1)!)$, matching Wolfram's LogGamma[5] = Log[24]",
      },
      {
        expr: ["GammaLn", ["Around", 1.2, 0.01]],
        expected: ["Around", -0.08537409000331583, 0.002890398965921884],
        aspirational: true,
        category: "Scope",
        caption:
          "Uncertainty propagation through $\\ln\\Gamma$, with slope $\\psi(1.2)$; `Around` is not declared",
      },
      {
        expr: ["D", ["GammaLn", "x"], "x"],
        expected: ["Digamma", "x"],
        category: "Properties",
        caption: "The derivative of $\\ln\\Gamma$ is the digamma function. See [[Digamma]]",
      },
      {
        expr: ["GammaLn", -1.5],
        expected: { num: "0.860047015376481014511" },
        category: "Possible issues",
        caption:
          "Off the positive axis GammaLn is the principal $\\ln\\Gamma(z)$: at $z = -3/2$, where $\\Gamma > 0$, that is real. See [[LogGamma]] for the continuation",
        divergence: {
          wolfram:
            "Wolfram's $\\mathrm{LogGamma}[-1.5] = 0.860047 - 6.28319\\,i$: its analytic continuation sits $-2\\pi i$ from the principal log here.",
        },
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
        category: "Scope",
        caption:
          "Half-integer arguments evaluate exactly through $\\Gamma(m + \\tfrac12) = \\frac{(2m)!}{4^m m!}\\sqrt{\\pi}$. Compare [[Binomial]] at half-integers",
      },
      {
        expr: ["Beta", 5, 4],
        expected: ["Rational", 1, 280],
        caption: "$B(5, 4) = \\frac{4!\\,3!}{8!} = \\frac{1}{280}$",
      },
      {
        expr: ["Beta", 2.3, 3.2],
        expected: { num: "0.0540297917483572378154" },
        caption: "Machine-precision arguments",
      },
      {
        expr: ["Beta", ["Rational", 5, 2], ["Rational", 7, 2]],
        expected: ["Multiply", ["Rational", 3, 256], "Pi"],
        category: "Scope",
        caption: "$B(5/2, 7/2) = \\frac{3\\pi}{256}$ from the half-integer gammas",
      },
      {
        expr: ["Beta", ["Complex", 2.5, 1], ["Complex", 1, -1]],
        expected: ["Complex", 0.08310778366991163, 0.14216394425587034],
        aspirational: true,
        category: "Scope",
        caption:
          "Complex arguments should evaluate numerically; left unevaluated today, even under N()",
      },
      {
        expr: ["Beta", ["Rational", 1, 2], 2, 3],
        expected: ["Rational", 11, 192],
        category: "Scope",
        caption:
          "Three arguments: the incomplete beta $B_z(a, b) = \\int_0^z t^{a-1}(1-t)^{b-1}\\,dt$, here $B_{1/2}(2, 3) = 11/192$",
      },
      {
        expr: ["Beta", ["Rational", 1, 4], ["Rational", 1, 2], 2, 3],
        expected: ["Rational", 109, 3072],
        category: "Scope",
        caption:
          "Four arguments: the generalized incomplete beta $B_{z_1}(a, b) - B_{z_0}(a, b)$, here $\\int_{1/4}^{1/2} t(1-t)^2\\,dt = 109/3072$",
      },
      {
        expr: ["Beta", "a", 1],
        expected: ["Divide", 1, "a"],
        category: "Properties",
        caption: "$B(a, 1) = 1/a$ for symbolic $a$",
      },
      {
        expr: ["Beta", 2, "b"],
        expected: ["Divide", 1, ["Multiply", "b", ["Add", "b", 1]]],
        aspirational: true,
        category: "Properties",
        caption: "$B(2, b) = \\frac{1}{b(b+1)}$; not yet",
      },
      {
        expr: ["D", ["Beta", "a", "b"], "a"],
        expected: [
          "Multiply",
          ["Beta", "a", "b"],
          ["Subtract", ["Digamma", "a"], ["Digamma", ["Add", "a", "b"]]],
        ],
        aspirational: true,
        category: "Properties",
        caption:
          "$\\partial_a B(a, b) = B(a, b)\\,(\\psi(a) - \\psi(a+b))$; today the derivative stays an unapplied `Derivative`",
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
        category: "Scope",
        caption: "Threads element-wise over a list, as Wolfram's Listable heads do",
      },
      {
        expr: ["Erf", 0.95],
        expected: { num: "0.820890807273277941908" },
        caption: "A machine-precision argument",
      },
      {
        expr: ["Erf", ["Complex", 1.5, -1]],
        expected: ["Complex", 1.0783992074989335, 0.027963711238655833],
        category: "Scope",
        caption: "Complex arguments evaluate directly",
      },
      {
        expr: ["Erf", 0.5, 1.5],
        expected: 0.4456052686622642,
        category: "Scope",
        caption:
          "Two arguments: the generalized $\\operatorname{erf}(z_0, z_1) = \\operatorname{erf}(z_1) - \\operatorname{erf}(z_0)$",
      },
      {
        expr: ["Erf", 1, 2],
        expected: ["Add", ["Negate", ["Erf", 1]], ["Erf", 2]],
        category: "Scope",
        caption:
          "...which with exact arguments is the difference $\\operatorname{erf}(2) - \\operatorname{erf}(1)$",
      },
      {
        expr: ["Erf", ["Interval", -2.1, -1.9]],
        expected: ["Interval", -0.997020533343667, -0.9927904292352575],
        aspirational: true,
        category: "Scope",
        caption:
          "Interval arithmetic: Erf is increasing, so the image of an interval is the interval of the endpoint images; today a type error",
      },
      {
        expr: ["Erf", ["Around", 2, 0.01]],
        expected: ["Around", 0.9953222650189527, 0.00020666985354092054],
        category: "Scope",
        caption: "Uncertainty propagation, with slope $\\frac{2}{\\sqrt\\pi}e^{-4}$",
      },
      {
        expr: ["Multiply", 0.5, ["Add", 1, ["Erf", ["Divide", 1.96, ["Sqrt", 2]]]]],
        expected: { num: "0.9750021048517795658635" },
        category: "Applications",
        caption:
          "The standard normal CDF $\\Phi(x) = \\frac12(1 + \\operatorname{erf}(x/\\sqrt2))$ at $x = 1.96$: the familiar 97.5%",
      },
      {
        expr: ["Erf", ["Negate", "x"]],
        expected: ["Negate", ["Erf", "x"]],
        category: "Properties",
        caption:
          "Oddness applied symbolically: $\\operatorname{erf}(-x) = -\\operatorname{erf}(x)$",
      },
      {
        expr: ["Erf", ["ErfInv", "x"]],
        expected: "x",
        category: "Properties",
        caption:
          "$\\operatorname{erf}(\\operatorname{erfinv}(x)) = x$ symbolically. See [[ErfInv]]",
      },
      {
        expr: ["Erf", "ImaginaryUnit"],
        expected: ["Multiply", "ImaginaryUnit", ["Erfi", 1]],
        aspirational: true,
        category: "Properties",
        caption:
          "On the imaginary axis: $\\operatorname{erf}(i) = i\\,\\operatorname{erfi}(1)$; not yet",
      },
      {
        expr: ["D", ["Erf", "x"], "x"],
        expected: [
          "Divide",
          ["Multiply", 2, ["Power", "ExponentialE", ["Negate", ["Power", "x", 2]]]],
          ["Sqrt", "Pi"],
        ],
        category: "Properties",
        caption:
          "$\\frac{d}{dx}\\operatorname{erf}(x) = \\frac{2}{\\sqrt\\pi}e^{-x^2}$, the Gaussian itself",
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
        category: "Scope",
        caption: "Threads element-wise over a list, as Wolfram's Listable heads do",
      },
      {
        expr: ["Erfc", 1.5],
        expected: { num: "0.033894853524689272933" },
        caption: "A machine-precision argument",
      },
      {
        expr: ["Erfc", ["Complex", 1.5, -1]],
        expected: ["Complex", -0.07839920749893345, -0.027963711238655847],
        aspirational: true,
        category: "Scope",
        caption:
          "Complex arguments should evaluate, as they do for [[Erf]]: $\\operatorname{erfc}(z) = 1 - \\operatorname{erf}(z)$; left unevaluated today",
      },
      {
        expr: ["Erfc", ["List", "PositiveInfinity", "NegativeInfinity"]],
        expected: ["List", 0, 2],
        category: "Scope",
        caption: "Listable: threads over its limits at $\\pm\\infty$",
      },
      {
        expr: ["Erfc", ["Interval", 0.2, 0.3]],
        expected: ["Interval", 0.6713732405408726, 0.7772974107895215],
        aspirational: true,
        category: "Scope",
        caption:
          "Interval arithmetic: Erfc is decreasing, so the endpoints swap; today a type error",
      },
      {
        expr: ["Erfc", ["Around", 2, 0.01]],
        expected: ["Around", 0.004677734981047266, 0.00020666985354092054],
        aspirational: true,
        category: "Scope",
        caption: "Uncertainty propagation; `Around` is not declared",
      },
      {
        expr: ["Erfc", ["Negate", "x"]],
        expected: ["Subtract", 2, ["Erfc", "x"]],
        aspirational: true,
        category: "Properties",
        caption:
          "$\\operatorname{erfc}(-x) = 2 - \\operatorname{erfc}(x)$ applied symbolically; not yet",
      },
      {
        expr: ["D", ["Erfc", "x"], "x"],
        expected: [
          "Divide",
          ["Multiply", -2, ["Power", "ExponentialE", ["Negate", ["Power", "x", 2]]]],
          ["Sqrt", "Pi"],
        ],
        category: "Properties",
        caption: "$\\frac{d}{dx}\\operatorname{erfc}(x) = -\\frac{2}{\\sqrt\\pi}e^{-x^2}$",
      },
      {
        expr: ["Erfc", 9.5],
        expected: { num: "3.76921448565487994168e-41" },
        category: "Possible issues",
        caption:
          "Far in the tail Erfc keeps full relative precision: $\\operatorname{erfc}(9.5) \\approx 3.8\\times10^{-41}$...",
      },
      {
        expr: ["Subtract", 1, ["Erf", 9.5]],
        expected: 0,
        category: "Possible issues",
        caption: "...whereas $1 - \\operatorname{erf}(9.5)$ cancels to exactly 0 in floating point",
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
        category: "Scope",
        caption: "Threads element-wise over a list, as Wolfram's Listable heads do",
      },
      {
        expr: ["ErfInv", 0.6],
        expected: { num: "0.595116081449994850019" },
        caption: "A machine-precision argument",
      },
      {
        expr: ["ErfInv", 0.4, 0.2],
        expected: 0.6317759030550063,
        category: "Scope",
        caption:
          "Two arguments: $\\operatorname{erfinv}(z_0, z)$ solves $z = \\operatorname{erf}(z_0, x) = \\operatorname{erf}(x) - \\operatorname{erf}(z_0)$",
      },
      {
        expr: ["ErfInv", ["Interval", 0.5, 0.6]],
        expected: ["Interval", 0.4769362762044699, 0.5951160814499948],
        aspirational: true,
        category: "Scope",
        caption:
          "Interval arithmetic: the inverse is increasing, so endpoints map to endpoints; today a type error",
      },
      {
        expr: ["ErfInv", ["Around", 0.5, 0.01]],
        expected: ["Around", 0.4769362762044699, 0.011125848189719498],
        aspirational: true,
        category: "Scope",
        caption: "Uncertainty propagation; `Around` is not declared",
      },
      {
        expr: ["Multiply", ["Sqrt", 2], ["ErfInv", 0.95]],
        expected: { num: "1.95996398454005423552746040017785193571357792" },
        category: "Applications",
        caption:
          "The normal quantile $\\sqrt2\\,\\operatorname{erfinv}(2p - 1)$ at $p = 0.975$: the 1.96 of a 95% confidence interval",
      },
      {
        expr: ["ErfInv", ["Negate", "x"]],
        expected: ["Negate", ["ErfInv", "x"]],
        category: "Properties",
        caption:
          "Odd: $\\operatorname{erfinv}(-x) = -\\operatorname{erfinv}(x)$ applied symbolically",
      },
      {
        expr: ["D", ["ErfInv", "x"], "x"],
        expected: [
          "Multiply",
          ["Rational", 1, 2],
          ["Sqrt", "Pi"],
          ["Power", "ExponentialE", ["Power", ["ErfInv", "x"], 2]],
        ],
        aspirational: true,
        category: "Properties",
        caption:
          "$\\frac{d}{dx}\\operatorname{erfinv}(x) = \\frac{\\sqrt\\pi}{2}e^{\\operatorname{erfinv}(x)^2}$; today the derivative stays an unapplied `Derivative`",
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
        note: "compute-engine's WGSLTarget has no lowering for Zeta; ours compiles Zeta(s) as zetaGen(s, 1) on the real-scalar path, and the complex-portrait fragment shader (complex-plot.ts) takes it as clogPolar(hurwitz(s, vec2f(1,0))).",
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
        expr: ["N", ["Zeta", ["Complex", 0.5, 14]]],
        expected: ["Complex", 0.02224114260999359, -0.10325812326645006],
        category: "Scope",
        caption:
          "On the critical line, $\\zeta(1/2 + 14i) = 0.02224\\ldots - 0.10326\\ldots i$ — complex $s$, from @enumeratio/analytic (compute-engine's Zeta evaluates real $s$ only). Computed in arbitrary precision and rounded once, so each part is the nearest double in every JavaScript engine",
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
      {
        expr: ["N", ["Zeta", 3]],
        expected: { num: "1.2020569031595942854" },
        caption: "Apéry's constant $\\zeta(3)$, numerically",
      },
      {
        expr: ["Zeta", 1.5],
        expected: { num: "2.61237534868548834335" },
        caption: "A machine-precision argument",
      },
      {
        expr: ["Zeta", 8],
        expected: ["Multiply", ["Rational", 1, 9450], ["Power", "Pi", 8]],
        caption: "$\\zeta(8) = \\pi^8/9450$",
      },
      {
        expr: ["Zeta", -5],
        expected: ["Rational", -1, 252],
        caption: "$\\zeta(-5) = -B_6/6 = -1/252$",
      },
      {
        expr: ["Zeta", 5.211111111111111],
        expected: { num: "1.03139179693438499839" },
        category: "Scope",
        caption: "Arbitrary real arguments",
      },
      {
        expr: ["Zeta", -4.5],
        expected: { num: "-0.00309166924721583384482" },
        category: "Scope",
        caption: "Left of the critical strip, via the functional equation",
      },
      {
        expr: ["N", ["Zeta", ["Complex", 2, -5]]],
        expected: ["Complex", 0.8509629436242628, -0.09899694613483125],
        category: "Scope",
        caption: "Complex $s$ under N()",
      },
      {
        expr: ["Zeta", "PositiveInfinity"],
        expected: 1,
        category: "Scope",
        caption: "$\\zeta(\\infty) = 1$: only the $n = 1$ term survives",
      },
      {
        expr: ["Zeta", -1, 5],
        expected: ["Rational", -121, 12],
        category: "Scope",
        caption:
          "Two arguments at a nonpositive integer $s$: $\\zeta(-1, 5) = -B_2(5)/2 = -121/12$",
      },
      {
        expr: ["Zeta", -1.5, 5],
        expected: { num: "-17.0500647493426550141295" },
        category: "Scope",
        caption: "Two arguments, inexact",
      },
      {
        expr: ["N", ["Zeta", ["Complex", -1.5, 1], ["Complex", 2.5, -1]], 10],
        expected: ["Complex", 0.01848680919, 1.675533784],
        category: "Scope",
        caption: "Two complex arguments under N(), to ten digits",
      },
      {
        expr: ["Zeta", ["Complex", -1.5, 1], ["Complex", 2.5, -1]],
        expected: ["Complex", 0.01848680919381065, 1.675533784301766],
        aspirational: true,
        category: "Scope",
        caption:
          "...which with inexact complex arguments should evaluate without N(), as the real case does; left unevaluated today",
      },
      {
        expr: ["Zeta", 20, ["Rational", 1, 2]],
        expected: ["Multiply", ["Rational", 221930581, 1856156927625], ["Power", "Pi", 20]],
        aspirational: true,
        category: "Scope",
        caption:
          "$\\zeta(20, 1/2) = (2^{20} - 1)\\zeta(20)$, an exact multiple of $\\pi^{20}$; not yet",
      },
      {
        expr: ["Zeta", 2, ["Rational", 1, 2]],
        expected: ["Multiply", ["Rational", 1, 2], ["Power", "Pi", 2]],
        aspirational: true,
        category: "Scope",
        caption: "$\\zeta(2, 1/2) = 3\\zeta(2) = \\pi^2/2$; not yet",
      },
      {
        expr: ["Zeta", ["Interval", 1.1, 1.2]],
        expected: ["Interval", 5.591582441177752, 10.584448464950801],
        aspirational: true,
        category: "Scope",
        caption: "Interval arithmetic: $\\zeta$ is decreasing on $(1, \\infty)$; not yet",
      },
      {
        expr: ["Zeta", ["Rational", 1, 2], ["Around", 0.5, 0.01]],
        expected: ["Around", -0.6048986434216304, 0.023882689737774167],
        aspirational: true,
        category: "Scope",
        caption:
          "Uncertainty in $a$, propagated with $\\partial_a\\zeta(s, a) = -s\\,\\zeta(s+1, a)$; `Around` is not declared",
      },
      {
        expr: ["Zeta", "s", 1],
        expected: ["Zeta", "s"],
        category: "Properties",
        caption: "$\\zeta(s, 1) = \\zeta(s)$ for symbolic $s$",
      },
    ],
    seeAlso: ["HurwitzZeta", "BernoulliB", "Gamma", "Digamma", "RiemannSiegelZ", "RiemannZetaZero"],
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
      "Numeric evaluation (under N()) is Euler–Maclaurin summation and supports complex $s$ and $a$; it is aligned with Wolfram's $\\mathrm{HurwitzZeta}[s, a]$. Left of $\\operatorname{Re}(s) = 0$, where those direct terms cancel, $a$ near the real axis goes through $\\zeta(s, 1+h) = \\sum_k \\binom{-s}{k} h^k \\zeta(s+k)$ instead, each $\\zeta(s+k)$ from the functional equation.",
      "That Euler–Maclaurin sum runs in arbitrary precision (as many digits as `ce.precision` asks for, checked against mpmath at 30 and 50 digits) whenever $s$ and $a$ are both real; a genuinely complex $s$ or $a$ is correct to the same number of digits internally, but the returned value is still one of compute-engine's own complex numbers, which is a pair of doubles -- so asking N() for 30 or 50 digits of a complex result gives back the same ~15-17 correct digits either way, a ceiling of compute-engine's complex-number representation rather than of this computation.",
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
      {
        expr: ["HurwitzZeta", 3, 0.2],
        expected: 125.73901805721795,
        aspirational: true,
        caption:
          "An inexact $a$ should evaluate numerically without N(), $\\zeta(3, 0.2) = 125.739\\ldots$; left unevaluated today",
      },
      {
        expr: ["N", ["HurwitzZeta", 0.51, 0.87]],
        expected: { num: "-1.32015502369495837551" },
        caption: "Inside the critical strip, under N()",
      },
      {
        expr: ["HurwitzZeta", 7, 5],
        expected: ["Add", ["Rational", -36130315, 35831808], ["Zeta", 7]],
        category: "Scope",
        caption:
          "A positive integer $a$ peels off the first terms: $\\zeta(7, 5) = \\zeta(7) - \\sum_{k=1}^{4} k^{-7}$",
      },
      {
        expr: ["N", ["HurwitzZeta", 2.3, ["Complex", 8, 1]]],
        expected: ["Complex", 0.05447008273213067, -0.009448515336470249],
        category: "Scope",
        caption: "Complex $a$",
      },
      {
        expr: ["HurwitzZeta", ["List", 2, 3, 4], 0.5],
        expected: ["List", 4.934802200544679, 8.41439832211716, 16.234848505667074],
        category: "Scope",
        caption: "Listable: threads over a list of orders",
      },
      {
        expr: ["HurwitzZeta", 2, ["Around", 0.5, 0.01]],
        expected: ["Around", 4.934802200544679, 0.1682879664423432],
        aspirational: true,
        category: "Scope",
        caption: "Uncertainty in $a$; `Around` is not declared",
      },
      {
        expr: ["HurwitzZeta", 2, ["Rational", 1, 2]],
        expected: ["Multiply", ["Rational", 1, 2], ["Power", "Pi", 2]],
        category: "Scope",
        caption:
          "$\\zeta(2, 1/2) = \\pi^2/2$ -- the $s = 2$ instance of $\\zeta(s, 1/2) = (2^s-1)\\zeta(s)$",
      },
      {
        expr: ["HurwitzZeta", 2, ["Rational", 1, 4]],
        expected: ["Add", ["Multiply", 8, "Catalan"], ["Power", "Pi", 2]],
        category: "Scope",
        caption: "$\\zeta(2, 1/4) = \\pi^2 + 8G$, with Catalan's constant $G$",
      },
      {
        expr: ["HurwitzZeta", "s", ["Rational", 1, 2]],
        expected: ["Multiply", ["Add", ["Power", 2, "s"], -1], ["Zeta", "s"]],
        category: "Properties",
        caption: "$\\zeta(s, 1/2) = (2^s - 1)\\zeta(s)$ for symbolic $s$",
      },
      {
        expr: ["HurwitzZeta", "s", 1],
        expected: ["Zeta", "s"],
        category: "Properties",
        caption: "$\\zeta(s, 1) = \\zeta(s)$ for symbolic $s$",
      },
      {
        expr: ["HurwitzZeta", 0, 0],
        expected: ["Rational", 1, 2],
        category: "Properties",
        caption: "$\\zeta(0, a) = \\tfrac12 - a$ holds at $a = 0$ too",
      },
      {
        expr: ["HurwitzZeta", -2, "a"],
        expected: [
          "Multiply",
          ["Rational", -1, 3],
          [
            "Add",
            ["Power", "a", 3],
            ["Multiply", ["Rational", -3, 2], ["Power", "a", 2]],
            ["Multiply", ["Rational", 1, 2], "a"],
          ],
        ],
        category: "Properties",
        caption: "$\\zeta(-2, a) = -B_3(a)/3$",
      },
      {
        expr: ["D", ["HurwitzZeta", "s", "a"], "a"],
        expected: ["Negate", ["Multiply", "s", ["HurwitzZeta", ["Add", "s", 1], "a"]]],
        category: "Properties",
        caption: "$\\partial_a\\zeta(s, a) = -s\\,\\zeta(s+1, a)$",
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
      "Numeric evaluation sums the series directly for $|z| < 1$ (geometric convergence), routes $z = 1$ through the Euler–Maclaurin Hurwitz kernel, and sums real $z < 0$ (the $z = -1$ rim included) by a van Wijngaarden Euler transform, so the alternating $\\eta(s)$ and Catalan cases reach machine precision. Past $|z| = 1$ it is continued by the Hermite-type integral representation, $\\Phi = \\tfrac{1}{2a^s} + z^{-a}(-\\ln z)^{s-1}\\Gamma(1-s, -a\\ln z) - 2\\int_0^\\infty \\frac{\\sin(t\\ln z - s\\arctan(t/a))}{(a^2+t^2)^{s/2}(e^{2\\pi t}-1)}\\,dt$, with other $a$ shifted by $\\Phi(z, s, a) = a^{-s} + z\\Phi(z, s, a+1)$; on the cut, real $z > 1$, it takes the side below, as mpmath and Wolfram do. Where the terms cancel below double precision, or the incomplete gamma can't be trusted (near the negative real axis past $|x| \\approx 20$), it stays unevaluated rather than guess.",
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
        expr: ["N", ["LerchPhi", ["Complex", 1, 2], ["Complex", 3, -1], ["Complex", 4, 2]]],
        expected: ["Complex", 0.002025009957012008, 0.0033278975368131974],
        category: "Scope",
        caption:
          "past the unit disk, by the integral representation (mpmath: 0.00202500995700991 + 0.00332789753681356i)",
        divergence: {
          wolfram:
            "Wolfram's machine-precision N drifts from the sixth digit here (0.00202501519…); N[LerchPhi[1 + 2 I, 3 - I, 4 + 2 I], 30] agrees with this value, as do mpmath and SymPy.",
        },
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
      {
        expr: ["LerchPhi", 0.5, 2, 3.5],
        expected: 0.11938622686982046,
        aspirational: true,
        caption:
          "Inexact arguments should evaluate numerically without N(); left unevaluated today",
      },
      {
        expr: ["LerchPhi", 49.5, 0, 2],
        expected: { num: "-0.0206185567010309278351" },
        category: "Scope",
        caption: "$s = 0$ far outside the unit disk: $1/(1 - 49.5)$",
      },
      {
        expr: ["LerchPhi", 7.5, 1, 2],
        expected: ["Complex", -0.16660981647825052, -0.05585053606381855],
        aspirational: true,
        category: "Scope",
        caption:
          "$|z| > 1$ by analytic continuation: $\\Phi(z, 1, 2) = (-\\ln(1-z) - z)/z^2$ at $z = 7.5$; left unevaluated today",
      },
      {
        expr: ["LerchPhi", ["Around", 0.5, 0.01], 1, 2],
        expected: ["Around", 0.7725887222397811, 0.00909645111040875],
        aspirational: true,
        category: "Scope",
        caption: "Uncertainty in $z$; `Around` is not declared",
      },
      {
        expr: ["LerchPhi", 0, "s", "a"],
        expected: ["Power", "a", ["Negate", "s"]],
        category: "Properties",
        caption: "$\\Phi(0, s, a) = a^{-s}$: only the $n = 0$ term survives",
      },
      {
        expr: ["LerchPhi", "z", "s", 1],
        expected: ["Divide", ["PolyLog", "s", "z"], "z"],
        category: "Properties",
        caption: "$\\Phi(z, s, 1) = \\operatorname{Li}_s(z)/z$ symbolically. See [[PolyLog]]",
      },
      {
        expr: ["LerchPhi", "z", 1, 1],
        expected: ["Divide", ["Negate", ["Ln", ["Add", ["Negate", "z"], 1]]], "z"],
        category: "Properties",
        caption:
          "$\\Phi(z, 1, 1) = -\\ln(1-z)/z$ -- the $s = 1$ instance, through $\\operatorname{Li}_1(z) = -\\ln(1-z)$",
      },
      {
        expr: ["LerchPhi", 1, 2, ["Rational", 1, 4]],
        expected: ["Add", ["Power", "Pi", 2], ["Multiply", 8, "Catalan"]],
        aspirational: true,
        category: "Properties",
        caption:
          "$\\Phi(1, 2, 1/4) = \\zeta(2, 1/4) = \\pi^2 + 8G$; today it stops at the HurwitzZeta",
      },
      {
        expr: ["LerchPhi", -1, 1, 1],
        expected: ["Ln", 2],
        category: "Properties",
        caption:
          "$\\Phi(-1, 1, 1) = \\eta(1) = \\ln 2$, the alternating harmonic series -- via $\\Phi(z,1,1) = -\\ln(1-z)/z$",
      },
      {
        expr: ["LerchPhi", ["Rational", 1, 2], 1, 1],
        expected: ["Multiply", 2, ["Ln", 2]],
        aspirational: true,
        category: "Properties",
        caption: "$\\Phi(1/2, 1, 1) = 2\\ln 2$; not yet",
      },
      {
        expr: ["LerchPhi", -1, 2, ["Rational", 1, 2]],
        expected: ["Multiply", 4, "Catalan"],
        aspirational: true,
        category: "Properties",
        caption: "$\\Phi(-1, 2, 1/2) = 4G$; not yet in closed form...",
      },
      {
        expr: ["N", ["LerchPhi", -1, 2, ["Rational", 1, 2]]],
        expected: 3.663862376708875,
        category: "Properties",
        caption: "...though N() gets $4G = 3.66386\\ldots$",
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
      {
        expr: ["PolyLog", 2, 0.9],
        expected: 1.2997147230049588,
        caption: "A machine-precision argument",
      },
      {
        expr: ["PolyLog", 0, 5.5],
        expected: { num: "-1.222222222222222222221" },
        caption: "$\\operatorname{Li}_0(z) = z/(1-z)$, past the unit disk",
      },
      {
        expr: ["PolyLog", 3, ["Rational", 1, 2]],
        expected: [
          "Add",
          ["Multiply", ["Rational", -1, 12], ["Ln", 2], ["Power", "Pi", 2]],
          ["Multiply", ["Rational", 1, 6], ["Power", ["Ln", 2], 3]],
          ["Multiply", ["Rational", 7, 8], ["Zeta", 3]],
        ],
        caption:
          "$\\operatorname{Li}_3(1/2) = \\frac78\\zeta(3) - \\frac{\\pi^2}{12}\\ln 2 + \\frac16\\ln^3 2$",
      },
      {
        expr: ["PolyLog", ["Complex", 0.2, 1], ["Complex", 0.5, -0.5]],
        expected: ["Complex", 0.07032652055051603, -0.5632932625398744],
        category: "Scope",
        caption: "Complex order and argument",
      },
      {
        expr: ["PolyLog", 2, 2.5],
        expected: ["Complex", 2.420790806565934, -2.878612231808261],
        category: "Scope",
        caption: "Past $z = 1$ the continuation is complex",
      },
      {
        expr: ["PolyLog", 3, -1],
        expected: ["Multiply", ["Rational", -3, 4], ["Zeta", 3]],
        category: "Scope",
        caption: "$\\operatorname{Li}_3(-1) = -\\eta(3) = -\\frac34\\zeta(3)$",
      },
      {
        expr: ["PolyLog", 2, 2],
        expected: [
          "Add",
          ["Multiply", ["Complex", 0, -1], "Pi", ["Ln", 2]],
          ["Multiply", ["Rational", 1, 4], ["Power", "Pi", 2]],
        ],
        category: "Scope",
        caption: "$\\operatorname{Li}_2(2) = \\pi^2/4 - i\\pi\\ln 2$ exactly",
      },
      {
        expr: ["PolyLog", "n", -1],
        expected: [
          "Multiply",
          ["Add", ["Power", 2, ["Add", ["Negate", "n"], 1]], -1],
          ["Zeta", "n"],
        ],
        aspirational: true,
        category: "Scope",
        caption: "$\\operatorname{Li}_n(-1) = -(1 - 2^{1-n})\\zeta(n)$ for symbolic $n$; not yet",
      },
      {
        expr: ["PolyLog", -2, "z"],
        expected: [
          "Divide",
          ["Multiply", "z", ["Add", "z", 1]],
          ["Power", ["Add", ["Negate", "z"], 1], 3],
        ],
        aspirational: true,
        category: "Scope",
        caption:
          "$\\operatorname{Li}_{-2}(z) = z(1+z)/(1-z)^3$; only orders $-1, 0, 1$ reduce today",
      },
      {
        expr: ["PolyLog", 2, ["Interval", 0.7, 0.8]],
        expected: ["Interval", 0.8893776242860387, 1.0747946000082484],
        aspirational: true,
        category: "Scope",
        caption: "Interval arithmetic; not yet",
      },
      {
        expr: ["PolyLog", 1, 2, 1],
        expected: ["Zeta", 3],
        category: "Scope",
        caption:
          "Three arguments: the Nielsen generalized polylogarithm $S_{n,p}(z)$, with $S_{1,2}(1) = \\zeta(3)$",
      },
      {
        expr: ["PolyLog", 2, 2, 1],
        expected: ["Multiply", ["Rational", 1, 360], ["Power", "Pi", 4]],
        category: "Scope",
        caption: "$S_{2,2}(1) = \\pi^4/360$",
      },
      {
        expr: ["PolyLog", 1, 2, 0.5],
        expected: 0.0947530042301277,
        category: "Scope",
        caption: "$S_{1,2}(1/2) = \\zeta(3)/8 - \\ln^3 2/6$",
      },
      {
        expr: ["PolyLog", "s", 1],
        expected: ["Zeta", "s"],
        category: "Properties",
        caption: "$\\operatorname{Li}_s(1) = \\zeta(s)$ for symbolic $s$",
      },
      {
        expr: ["D", ["PolyLog", "n", "x"], "x"],
        expected: ["Divide", ["PolyLog", ["Subtract", "n", 1], "x"], "x"],
        aspirational: true,
        category: "Properties",
        caption:
          "$\\frac{d}{dx}\\operatorname{Li}_n(x) = \\operatorname{Li}_{n-1}(x)/x$; today the derivative stays an unapplied `Derivative`",
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
      {
        expr: ["PolyGamma", 5],
        expected: ["Add", ["Rational", 25, 12], ["Negate", "EulerGamma"]],
        caption:
          "One argument is the digamma: $\\psi(5) = H_4 - \\gamma = \\frac{25}{12} - \\gamma$. See [[Digamma]]",
      },
      {
        expr: ["PolyGamma", 3, 5],
        expected: [
          "Add",
          ["Rational", -22369, 3456],
          ["Multiply", ["Rational", 1, 15], ["Power", "Pi", 4]],
        ],
        aspirational: true,
        caption:
          "$\\psi^{(3)}(5) = \\pi^4/15 - 22369/3456$; not yet -- exact arguments stay symbolic",
      },
      {
        expr: ["N", ["PolyGamma", 3, 5]],
        expected: { num: "0.0214278281927550750219" },
        caption: "...numerically",
      },
      {
        expr: ["PolyGamma", 2, 0.5],
        expected: { num: "-16.8287966442343199956" },
        caption: "$\\psi''(1/2) = -14\\zeta(3)$",
      },
      {
        expr: ["PolyGamma", 100.5],
        expected: 4.605174352581845,
        category: "Scope",
        caption: "One-argument digamma at a machine-precision point",
      },
      {
        expr: ["PolyGamma", ["Complex", 2.5, 3]],
        expected: ["Complex", 1.2812739190662314, 0.9798053153445596],
        category: "Scope",
        caption: "One-argument digamma at a complex point",
      },
      {
        expr: ["PolyGamma", 1, ["Complex", 2.5, 3]],
        expected: ["Complex", 0.15559788847194553, -0.2303795530823235],
        category: "Scope",
        caption: "Complex argument, integer order",
      },
      {
        expr: ["PolyGamma", 1, -0.5],
        expected: { num: "8.93480220054467930942" },
        category: "Scope",
        caption: "Between poles: $\\psi'(-1/2) = \\pi^2/2 + 4$",
      },
      {
        expr: ["PolyGamma", 1, "PositiveInfinity"],
        expected: 0,
        category: "Scope",
        caption: "$\\psi'(\\infty) = 0$",
      },
      {
        expr: ["PolyGamma", 1, ["Interval", 3.45, 3.46]],
        expected: ["Interval", 0.3347428975404412, 0.3358572806118117],
        aspirational: true,
        category: "Scope",
        caption: "Interval arithmetic: the trigamma is decreasing; not yet",
      },
      {
        expr: ["PolyGamma", 0, 1],
        expected: ["Negate", "EulerGamma"],
        category: "Properties",
        caption:
          "$\\psi^{(0)}(1) = -\\gamma$ -- PolyGamma(0, z) routes through Digamma(z) (#113) whenever Digamma has an exact value",
      },
      {
        expr: ["PolyGamma", 0, ["Rational", 1, 2]],
        expected: ["Subtract", ["Negate", "EulerGamma"], ["Multiply", 2, ["Ln", 2]]],
        aspirational: true,
        category: "Properties",
        caption: "$\\psi(1/2) = -\\gamma - 2\\ln 2$; not yet",
      },
      {
        expr: ["PolyGamma", 1, ["Rational", 1, 2]],
        expected: ["Multiply", ["Rational", 1, 2], ["Power", "Pi", 2]],
        aspirational: true,
        category: "Properties",
        caption: "$\\psi'(1/2) = \\pi^2/2$ in closed form; not yet",
      },
      {
        expr: ["PolyGamma", 1, ["Rational", 1, 4]],
        expected: ["Add", ["Multiply", 8, "Catalan"], ["Power", "Pi", 2]],
        category: "Properties",
        caption: "$\\psi'(1/4) = \\pi^2 + 8G$",
      },
      {
        expr: ["D", ["PolyGamma", "n", "x"], "x"],
        expected: ["PolyGamma", ["Add", "n", 1], "x"],
        category: "Properties",
        caption: "$\\frac{d}{dx}\\psi^{(n)}(x) = \\psi^{(n+1)}(x)$",
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
      "compute-engine's plain evaluation would otherwise leave Digamma at an exact integer argument symbolic except at the poles; `@enumeratio/analytic` overrides it at every positive integer via $\\psi(n) = H_{n-1} - \\gamma$, reusing [[HarmonicNumber]]. A rational, non-integer argument, or N(), still goes through the numeric path.",
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
          ["Add", 1, ["Negate", "EulerGamma"]],
          ["Add", ["Rational", 3, 2], ["Negate", "EulerGamma"]],
        ],
        category: "Scope",
        caption:
          "Threads over a list, reducing each positive-integer element to its closed form in $\\gamma$",
      },
      {
        expr: ["Digamma", 100.5],
        expected: { num: "4.60517435258184521187" },
        caption: "A machine-precision argument",
      },
      {
        expr: ["Digamma", 5],
        expected: ["Add", ["Rational", 25, 12], ["Negate", "EulerGamma"]],
        caption: "$\\psi(5) = H_4 - \\gamma = \\frac{25}{12} - \\gamma$",
      },
      {
        expr: ["Digamma", ["Complex", 2.5, 3]],
        expected: ["Complex", 1.2812739190662314, 0.9798053153445596],
        aspirational: true,
        category: "Scope",
        caption:
          "Complex arguments should evaluate, as $\\psi^{(m)}$ does for $m \\geq 1$ (see [[PolyGamma]]); left unevaluated today",
      },
      {
        expr: ["Digamma", "PositiveInfinity"],
        expected: "PositiveInfinity",
        category: "Scope",
        caption: "$\\psi(\\infty) = \\infty$, growing like $\\ln z$",
      },
      {
        expr: ["Digamma", ["Rational", 1, 4]],
        expected: [
          "Add",
          ["Multiply", -3, ["Ln", 2]],
          ["Multiply", ["Rational", -1, 2], "Pi"],
          ["Negate", "EulerGamma"],
        ],
        category: "Scope",
        caption: "Gauss's digamma theorem: $\\psi(1/4) = -\\gamma - \\pi/2 - 3\\ln 2$",
      },
      {
        expr: ["Digamma", ["Rational", 1, 3]],
        expected: [
          "Add",
          ["Multiply", ["Rational", -3, 2], ["Ln", 3]],
          ["Multiply", ["Negate", ["Divide", ["Sqrt", 3], 6]], "Pi"],
          ["Negate", "EulerGamma"],
        ],
        category: "Scope",
        caption: "$\\psi(1/3) = -\\gamma - \\frac{\\pi}{2\\sqrt3} - \\frac32\\ln 3$",
      },
      {
        expr: ["Digamma", ["Interval", 1.23, 1.24]],
        expected: ["Interval", -0.2516694306961001, -0.2394936791259368],
        aspirational: true,
        category: "Scope",
        caption: "Interval arithmetic: $\\psi$ is increasing on $(0, \\infty)$; not yet",
      },
      {
        expr: ["D", ["Digamma", "x"], "x"],
        expected: ["Trigamma", "x"],
        category: "Properties",
        caption: "$\\psi'(x)$ is the trigamma, $\\psi^{(1)}(x)$",
        divergence: {
          wolfram:
            "Wolfram writes the derivative as $\\mathrm{PolyGamma}[1, x]$; compute-engine names it `Trigamma`.",
        },
      },
      {
        expr: ["Subtract", ["Digamma", 0.7], ["Digamma", 0.3]],
        expected: { num: "2.28250066850219837421" },
        category: "Properties",
        caption:
          "Reflection: $\\psi(1-x) - \\psi(x) = \\pi\\cot(\\pi x)$, here $\\pi\\cot(0.3\\pi) = 2.2825\\ldots$",
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
        category: "Scope",
        caption: "Threads element-wise over a list, as Wolfram's Listable heads do",
      },
      {
        expr: ["GammaRegularized", 1, 1.5],
        expected: { num: "0.223130160148429828933" },
        caption: "$Q(1, z) = e^{-z}$ at $z = 1.5$",
      },
      {
        expr: ["GammaRegularized", 2, 3.3],
        expected: { num: "0.15859761982533202341608" },
        caption: "$Q(2, 3.3) = 4.3\\,e^{-3.3}$",
      },
      {
        expr: ["N", ["GammaRegularized", ["Complex", 1, 1], 2.5]],
        expected: [
          "Complex",
          { num: "0.00794706062011918622237387002562211784" },
          0.15253677854101844,
        ],
        category: "Scope",
        caption: "Complex order, under N()",
      },
      {
        expr: ["GammaRegularized", 2.5, 0.5, 1.5],
        expected: 0.26257993736866897,
        category: "Scope",
        caption:
          "Three arguments: $Q(a, z_0) - Q(a, z_1)$, the Gamma(5/2) mass between $1/2$ and $3/2$",
      },
      {
        expr: ["GammaRegularized", 2, 0.5, 1.5],
        expected: 0.35197058919787555,
        aspirational: true,
        category: "Scope",
        caption:
          "...which at an integer order should equally evaluate, to $\\frac32e^{-1/2} - \\frac52e^{-3/2}$; left unevaluated today",
      },
      {
        expr: ["GammaRegularized", 1, ["List", "NegativeInfinity", "PositiveInfinity"]],
        expected: ["List", "PositiveInfinity", 0],
        category: "Scope",
        caption: "Listable over its limits: $Q(1, -\\infty) = \\infty$, $Q(1, \\infty) = 0$",
      },
      {
        expr: ["GammaRegularized", 2, ["List", ["List", 3.5, 0], ["List", 0, 6.5]]],
        expected: ["List", ["List", 0.13588822540043324, 1], ["List", 1, 0.011275793947331794]],
        category: "Scope",
        caption: "Listable: threads elementwise over a matrix",
      },
      {
        expr: ["GammaRegularized", ["Rational", 2, 5], ["Interval", 0.21, 0.22]],
        expected: ["Interval", 0.42124489579195323, 0.4303906669405995],
        aspirational: true,
        category: "Scope",
        caption: "Interval arithmetic: $Q$ is decreasing in $z$; today a type error",
      },
      {
        expr: ["Subtract", 1, ["GammaRegularized", 0.5, 1.9207294103470425]],
        expected: { num: "0.9499999999999987786437" },
        category: "Applications",
        caption:
          "The $\\chi^2_1$ CDF, $P(1/2, x/2)$, at the familiar critical value $x = 3.8415$: 95%",
      },
      {
        expr: ["GammaRegularized", "a", 0],
        expected: 1,
        category: "Properties",
        caption: "$Q(a, 0) = 1$ for symbolic $a$",
      },
      {
        expr: ["GammaRegularized", "a", "PositiveInfinity"],
        expected: 0,
        category: "Properties",
        caption: "$Q(a, \\infty) = 0$",
      },
      {
        expr: ["GammaRegularized", 1, "x"],
        expected: ["Power", "ExponentialE", ["Negate", "x"]],
        category: "Properties",
        caption: "$Q(1, x) = e^{-x}$ symbolically",
      },
      {
        expr: ["GammaRegularized", 2, "x"],
        expected: ["Multiply", ["Add", "x", 1], ["Power", "ExponentialE", ["Negate", "x"]]],
        category: "Properties",
        caption:
          "$Q(2, x) = (1 + x)e^{-x}$, through $Q(s,x) = \\Gamma(s,x)/\\Gamma(s)$ now that $\\Gamma(2,x)$ has a closed form",
      },
      {
        expr: ["GammaRegularized", ["Rational", 1, 2], "x"],
        expected: ["Erfc", ["Sqrt", "x"]],
        category: "Properties",
        caption: "$Q(1/2, x) = \\operatorname{erfc}(\\sqrt x)$. See [[Erfc]]",
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
        category: "Scope",
        caption: "Threads element-wise over a list, as Wolfram's Listable heads do",
      },
      {
        expr: ["BetaRegularized", 0.4, 2.5, 3.5],
        expected: { num: "0.486904191526117355254" },
        caption: "Non-integer parameters",
      },
      {
        expr: ["BetaRegularized", ["Rational", 1, 2], 2, 3],
        expected: ["Rational", 11, 16],
        caption: "$I_{1/2}(2, 3) = 11/16$ exactly",
      },
      {
        expr: ["BetaRegularized", 2, 0.5, 5],
        expected: 1.1821941497962591,
        aspirational: true,
        category: "Scope",
        caption:
          "$x$ outside $[0, 1]$ by continuation: real here, as $b = 5$ makes the integrand a polynomial times $t^{-1/2}$; left unevaluated today",
      },
      {
        expr: ["BetaRegularized", 0.2, 0.5, 2, 3],
        expected: 0.5067,
        category: "Scope",
        caption: "Four arguments: the generalized $I_{z_1}(a, b) - I_{z_0}(a, b)$",
      },
      {
        expr: ["BetaRegularized", ["Interval", 0.2, 0.3], 2, 1],
        expected: ["Interval", 0.04, 0.09],
        aspirational: true,
        category: "Scope",
        caption: "Interval arithmetic: $I_x(2, 1) = x^2$; today a type error",
      },
      {
        expr: ["BetaRegularized", ["Around", 0.3, 0.01], 1, 2],
        expected: ["Around", 0.51, 0.014],
        aspirational: true,
        category: "Scope",
        caption: "Uncertainty propagation; `Around` is not declared",
      },
      {
        expr: ["BetaRegularized", 0.2111111111111111, 5, 1],
        expected: { num: "0.000419329539873664134599" },
        category: "Properties",
        caption: "$I_x(a, 1) = x^a$, here $0.2111\\ldots^5$",
      },
      {
        expr: ["BetaRegularized", 0.5, ["Rational", 1, 2], ["Rational", 1, 2]],
        expected: 0.5,
        category: "Properties",
        caption: "The arcsine distribution's median: $I_{1/2}(1/2, 1/2) = 1/2$",
      },
      {
        expr: ["BetaRegularized", "x", 1, 1],
        expected: "x",
        aspirational: true,
        category: "Properties",
        caption: "$I_x(1, 1) = x$ symbolically; not yet",
      },
      {
        expr: ["BetaRegularized", "x", "a", 1],
        expected: ["Power", "x", "a"],
        aspirational: true,
        category: "Properties",
        caption: "$I_x(a, 1) = x^a$ symbolically; not yet",
      },
      {
        expr: ["BetaRegularized", "x", 1, "b"],
        expected: ["Subtract", 1, ["Power", ["Subtract", 1, "x"], "b"]],
        aspirational: true,
        category: "Properties",
        caption: "$I_x(1, b) = 1 - (1-x)^b$; not yet",
      },
    ],
    seeAlso: ["Beta", "GammaRegularized", "Binomial"],
  },
  {
    name: "IncompleteEllipticPi",
    domain: "Special functions",
    signature: "IncompleteEllipticPi(n, phi, m)",
    summary:
      "The incomplete Legendre elliptic integral of the third kind, $\\Pi(n;\\varphi,m) = \\int_0^\\varphi \\dfrac{d\\theta}{(1-n\\sin^2\\theta)\\sqrt{1-m\\sin^2\\theta}}$, in Wolfram/mpmath's $(n,\\varphi,m)$ order with $m=k^2$.",
    signatures: [
      {
        call: "IncompleteEllipticPi(n, phi, m)",
        description:
          "the incomplete elliptic integral of the third kind, characteristic n, amplitude φ, parameter m.",
        library: "@enumeratio/analytic",
      },
    ],
    details: [
      "$m = k^2$, the same convention [[EllipticE]] / [[EllipticF]] use — not the elliptic modulus k itself.",
      "$\\varphi = \\pi/2$ is the complete integral: $\\Pi(n;\\pi/2,m) = $ [[EllipticPi]]$(n,m)$.",
      "Built from Carlson's symmetric $R_F$/$R_J$ (DLMF 19.25.14) rather than delegating to compute-engine's native three-argument EllipticPi, which returns NaN for some complex φ inside its own stated domain.",
      "Quasi-periodic: $\\Pi(n;\\varphi+k\\pi,m) = 2k\\,\\Pi(n,m) + \\Pi(n;\\varphi,m)$ for integer k, so any φ reduces to $[-\\pi/2,\\pi/2]$ before the Carlson evaluation.",
      "Numeric only — a symbolic or exact argument stays unevaluated; a floating-point argument (or `N()`) evaluates directly, same as [[EllipticE]] and [[EllipticF]].",
    ],
    examples: [
      { expr: ["IncompleteEllipticPi", 0.5, 0, 0.3], expected: 0, caption: "Π(n; 0, m) = 0" },
      {
        expr: ["N", ["IncompleteEllipticPi", 0.5, 0.4, 0.3]],
        expected: 0.41415173682447676,
        caption: "A floating-point argument evaluates directly to a decimal",
      },
      {
        expr: ["N", ["IncompleteEllipticPi", 0, 0.4, 0.3]],
        expected: 0.40316499194713934,
        category: "Properties",
        caption:
          "n = 0 reduces to the incomplete elliptic integral of the first kind, IncompleteEllipticF(φ, m)",
      },
      {
        expr: ["N", ["IncompleteEllipticPi", 0.2, ["Complex", 1.2, 0.5], 0.3]],
        expected: ["Complex", 1.321415376117118, 0.7186657188751806],
        category: "Scope",
        caption:
          "A complex amplitude φ, where native EllipticPi returns NaN even though φ is inside its own stated domain",
      },
      {
        expr: ["IncompleteEllipticPi", "n", "phi", "m"],
        expected: ["IncompleteEllipticPi", "n", "phi", "m"],
        category: "Possible issues",
        caption: "Symbolic arguments are left unevaluated rather than guessed at",
      },
    ],
    seeAlso: ["EllipticPi", "EllipticE", "EllipticF"],
  },
  {
    name: "KeiperLiLambda",
    domain: "Special functions",
    signature: "KeiperLiLambda(n)",
    summary:
      "The n-th Keiper–Li coefficient $\\lambda_n = \\dfrac{1}{(n-1)!}\\dfrac{d^n}{ds^n}\\left[s^{n-1}\\log\\xi(s)\\right]_{s=1}$, whose nonnegativity for every n is equivalent to the Riemann hypothesis.",
    signatures: [
      {
        call: "KeiperLiLambda(n)",
        description: "the n-th Keiper–Li coefficient, for a nonnegative integer n.",
        library: "@enumeratio/analytic",
      },
    ],
    details: [
      "$\\xi(s) = \\tfrac12 s(s-1)\\pi^{-s/2}\\Gamma(s/2)\\zeta(s)$, the completed (Riemann) xi function — entire, and sharing ζ's nontrivial zeros.",
      "$\\lambda_0 = 0$ and $\\lambda_1 = 1 + \\gamma/2 - \\tfrac12\\ln(4\\pi) \\approx 0.02310$ are closed forms; both evaluate exactly under plain evaluation, not just under N().",
      "$n \\geq 2$ is computed by Cauchy's differentiation formula — a contour integral of $\\log\\xi$ around $s=1$ — since repeated finite differences lose too much precision by n = 2 or 3.",
      "Numeric only for n ≥ 2: needs N() or a floating-point argument.",
      "Declines (leaves the call unevaluated) past n = 20, where float64 rounding in the contour sum starts costing real digits, and for any negative or non-integer n.",
      "Li's criterion: the Riemann hypothesis holds if and only if $\\lambda_n \\geq 0$ for every positive integer n.",
    ],
    examples: [
      { expr: ["KeiperLiLambda", 0], expected: 0, caption: "λ₀ = 0, exact under plain evaluation" },
      {
        expr: ["KeiperLiLambda", 1],
        expected: [
          "Add",
          1,
          ["Multiply", ["Rational", -1, 2], ["Ln", ["Multiply", 4, "Pi"]]],
          ["Multiply", ["Rational", 1, 2], "EulerGamma"],
        ],
        caption: "λ₁'s closed form, exact under plain evaluation",
      },
      {
        expr: ["N", ["KeiperLiLambda", 1]],
        expected: { num: "0.0230957089661210338135" },
        caption: "N() forces the closed form to a decimal",
      },
      {
        expr: ["N", ["KeiperLiLambda", 2]],
        expected: 0.09234573522804794,
        caption: "n ≥ 2 is numeric-only: the contour-integral evaluator",
      },
      {
        expr: ["N", ["KeiperLiLambda", 3]],
        expected: 0.20763892055433203,
      },
      {
        expr: ["KeiperLiLambda", 21],
        expected: ["KeiperLiLambda", 21],
        category: "Possible issues",
        caption:
          "Declines past n = 20 rather than returning a value that has quietly lost precision",
      },
    ],
    seeAlso: ["Zeta"],
  },
];
