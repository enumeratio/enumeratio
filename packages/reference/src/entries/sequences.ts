import type { ReferenceEntry } from "../types.ts";

// Combinatorial number sequences (Catalan, Bell, Stirling, Subfactorial,
// Factorial2) live in combinatorics.ts; this file keeps the recurrence-defined
// integer/rational sequences.
export const sequences: readonly ReferenceEntry[] = [
  {
    name: "Fibonacci",
    domain: "Sequences",
    signature: "Fibonacci(n)",
    summary:
      "The nth Fibonacci number, with $F_0 = 0$ and $F_1 = 1$, extended to negative n by the same recurrence.",
    signatures: [
      { call: "Fibonacci(n)", description: "the nth Fibonacci number $F_n$." },
      {
        call: "Fibonacci(nu)",
        description:
          "a real (non-integer) index via Binet's formula, $F_\\nu = \\frac{\\varphi^\\nu - \\cos(\\pi\\nu)\\varphi^{-\\nu}}{\\sqrt5}$.",
        library: "enumeratio-number-theory",
      },
      {
        call: "Fibonacci(n, x)",
        description:
          "the Fibonacci polynomial $F_n(x)$, from $F_n(x) = xF_{n-1}(x) + F_{n-2}(x)$, exact for a nonnegative integer n.",
        library: "enumeratio-number-theory",
      },
    ],
    details: [
      "Defined by the recurrence $F_n = F_{n-1} + F_{n-2}$ with $F_0 = 0$, $F_1 = 1$.",
      "Closed form (Binet's formula): $F_n = \\frac{\\varphi^n - \\psi^n}{\\sqrt5}$, where $\\varphi = \\frac{1+\\sqrt5}{2}$ and $\\psi = \\frac{1-\\sqrt5}{2}$.",
      "Consecutive ratios $F_{n+1}/F_n$ converge to the golden ratio $\\varphi$. See [[LucasL]].",
      "GCD identity: $\\gcd(F_m, F_n) = F_{\\gcd(m,n)}$.",
      "Extends to negative n via $F_{-n} = (-1)^{n+1} F_n$.",
      "A list of indices is threaded over element-wise; a real (non-integer) index evaluates numerically via Binet's formula, and a symbolic second argument gives the Fibonacci polynomial.",
    ],
    examples: [
      { expr: ["Fibonacci", 0], expected: 0 },
      { expr: ["Fibonacci", 1], expected: 1 },
      { expr: ["Fibonacci", 10], expected: 55 },
      { expr: ["Fibonacci", 20], expected: 6765 },
      { expr: ["Fibonacci", 8], expected: 21 },
      {
        expr: ["Fibonacci", 100],
        expected: { num: "354224848179261915075" },
        category: "Scope",
        caption: "Exact at any size: $F_{100}$ has 21 digits",
      },
      {
        expr: ["Fibonacci", 1.5],
        expected: 0.920442065259926,
        category: "Scope",
        caption:
          "A real index uses $F_\\nu = \\frac{\\varphi^\\nu - \\cos(\\pi\\nu)\\,\\varphi^{-\\nu}}{\\sqrt5}$",
      },
      {
        expr: ["Fibonacci", 7, "x"],
        expected: [
          "Add",
          ["Power", "x", 6],
          ["Multiply", 5, ["Power", "x", 4]],
          ["Multiply", 6, ["Power", "x", 2]],
          1,
        ],
        category: "Scope",
        caption:
          "The two-argument Fibonacci polynomial $F_7(x)$, from $F_n(x) = x F_{n-1}(x) + F_{n-2}(x)$",
      },
      {
        expr: ["Fibonacci", 5.8, 3],
        expected: 283.4827308329499,
        aspirational: true,
        category: "Scope",
        caption: "The Fibonacci polynomial at a real order and argument; not yet supported",
      },
      {
        expr: ["Fibonacci", 1, 0],
        expected: 1,
        category: "Scope",
        caption: "Special value of the Fibonacci polynomial: $F_1(0) = 1$",
      },
      {
        expr: ["Fibonacci", 0, 0],
        expected: 0,
        category: "Scope",
        caption: "Special value of the Fibonacci polynomial: $F_0(0) = 0$",
      },
      {
        expr: ["Fibonacci", 3, ["List", ["List", -1, 0], ["List", 0, 5]]],
        expected: ["List", ["List", 2, 1], ["List", 1, 26]],
        category: "Scope",
        caption: "$F_3(x) = x^2 + 1$ threads element-wise over a matrix argument",
      },
      {
        expr: ["Sum", ["Fibonacci", "k"], ["Tuple", "k", 1, 10]],
        expected: 143,
        category: "Properties",
        caption: "$\\sum_{k=1}^{n} F_k = F_{n+2} - 1$, here $F_{12} - 1 = 143$",
      },
      {
        expr: ["Equal", ["Fibonacci", 20], ["Multiply", ["Fibonacci", 10], ["LucasL", 10]]],
        expected: "True",
        category: "Properties",
        caption: "The doubling identity $F_{2n} = F_n L_n$. See [[LucasL]]",
      },
      {
        expr: ["Length", ["IntegerDigits", ["Fibonacci", 1000]]],
        expected: 209,
        category: "Neat examples",
        caption: "$F_{1000}$ has 209 digits. See [[IntegerDigits]]",
      },
      {
        expr: ["Equal", ["Fibonacci", 10], ["Add", ["Fibonacci", 9], ["Fibonacci", 8]]],
        expected: "True",
        category: "Properties",
        caption: "The defining recurrence $F_{10} = F_9 + F_8$",
      },
      {
        expr: [
          "Subtract",
          ["Multiply", ["Fibonacci", 5], ["Fibonacci", 7]],
          ["Power", ["Fibonacci", 6], 2],
        ],
        expected: 1,
        category: "Properties",
        caption: "Cassini's identity $F_{n-1}F_{n+1} - F_n^2 = (-1)^n$, here at $n = 6$",
      },
      {
        expr: [
          "Equal",
          ["GCD", ["Fibonacci", 12], ["Fibonacci", 18]],
          ["Fibonacci", ["GCD", 12, 18]],
        ],
        expected: "True",
        category: "Properties",
        caption: "$\\gcd(F_{12}, F_{18}) = F_{\\gcd(12, 18)}$",
      },
      {
        expr: ["Fibonacci", -5],
        expected: 5,
        category: "Properties",
        caption: "Negative indices are supported via $F_{-n} = (-1)^{n+1} F_n$",
      },
      {
        expr: ["Divide", ["Fibonacci", 20], ["Fibonacci", 19]],
        expected: ["Rational", 6765, 4181],
        category: "Applications",
        caption:
          "Consecutive ratios $F_{n+1}/F_n$ converge to the golden ratio $\\varphi \\approx 1.618$. See [[LucasL]]",
      },
      {
        expr: ["Fibonacci", ["List", 1, 2, 3, 4]],
        expected: ["List", 1, 1, 2, 3],
        category: "Scope",
        caption: "Threads element-wise over a list, as Wolfram's Listable heads do",
      },
      {
        expr: ["Fibonacci", 50],
        expected: 12586269025,
        category: "Neat examples",
        caption: "They grow fast: $F_{50}$ already exceeds twelve billion",
      },
    ],
    seeAlso: ["LucasL"],
  },
  {
    name: "LucasL",
    domain: "Sequences",
    signature: "LucasL(n)",
    summary:
      "The nth Lucas number: the Fibonacci-style recurrence started from $L_0 = 2$, $L_1 = 1$, closely related to [[Fibonacci]].",
    signatures: [
      { call: "LucasL(n)", description: "the nth Lucas number $L_n$." },
      {
        call: "LucasL(nu)",
        description:
          "a real (non-integer) index via Binet's formula, $L_\\nu = \\varphi^\\nu + \\cos(\\pi\\nu)\\varphi^{-\\nu}$.",
        library: "enumeratio-number-theory",
      },
      {
        call: "LucasL(n, x)",
        description:
          "the Lucas polynomial $L_n(x)$, from $L_n(x) = xL_{n-1}(x) + L_{n-2}(x)$ with $L_0(x) = 2$, $L_1(x) = x$, exact for a nonnegative integer n.",
        library: "enumeratio-number-theory",
      },
    ],
    details: [
      "Defined by the same recurrence as [[Fibonacci]], $L_n = L_{n-1} + L_{n-2}$, but started from $L_0 = 2$, $L_1 = 1$.",
      "Closed form: $L_n = \\varphi^n + \\psi^n$, where $\\varphi = \\frac{1+\\sqrt5}{2}$ and $\\psi = \\frac{1-\\sqrt5}{2}$.",
      "Related to Fibonacci by $L_n = F_{n-1} + F_{n+1}$ and, conversely, $F_n = \\dfrac{L_{n-1} + L_{n+1}}{5}$.",
      "Consecutive ratios $L_{n+1}/L_n$ converge to the golden ratio, just as they do for [[Fibonacci]].",
      "Extends to negative n via $L_{-n} = (-1)^n L_n$.",
      "A list of indices is threaded over element-wise; a real (non-integer) index evaluates numerically via Binet's formula, and a symbolic second argument gives the Lucas polynomial.",
    ],
    examples: [
      { expr: ["LucasL", 0], expected: 2 },
      { expr: ["LucasL", 1], expected: 1 },
      { expr: ["LucasL", 5], expected: 11 },
      { expr: ["LucasL", 10], expected: 123 },
      {
        expr: ["LucasL", 100],
        expected: { num: "792070839848372253127" },
        category: "Scope",
        caption: "Exact at any size",
      },
      {
        expr: ["LucasL", -11],
        expected: -199,
        category: "Scope",
        caption: "An odd negative index flips the sign: $L_{-11} = -L_{11}$",
      },
      {
        expr: ["LucasL", 2.3333333333333335],
        expected: 3.2362118794916213,
        category: "Scope",
        caption: "A real index uses $L_\\nu = \\varphi^\\nu + \\cos(\\pi\\nu)\\,\\varphi^{-\\nu}$",
      },
      {
        expr: ["LucasL", 7, "x"],
        expected: [
          "Add",
          ["Power", "x", 7],
          ["Multiply", 7, ["Power", "x", 5]],
          ["Multiply", 14, ["Power", "x", 3]],
          ["Multiply", 7, "x"],
        ],
        category: "Scope",
        caption:
          "The two-argument Lucas polynomial $L_7(x)$, from $L_n(x) = x L_{n-1}(x) + L_{n-2}(x)$",
      },
      {
        expr: ["LucasL", 143, 1],
        expected: { num: "767772505664398093937756525279" },
        category: "Scope",
        caption: "The Lucas polynomial at $x = 1$ is the Lucas number: $L_{143}(1) = L_{143}$",
      },
      {
        expr: ["LucasL", 1, 0],
        expected: 0,
        category: "Scope",
        caption: "Special value of the Lucas polynomial: $L_1(0) = 0$",
      },
      {
        expr: ["LucasL", 0, 0],
        expected: 2,
        category: "Scope",
        caption: "Special value of the Lucas polynomial: $L_0(0) = 2$",
      },
      {
        expr: [
          "LucasL",
          2,
          ["List", ["List", ["Rational", 1, 2], -1], ["List", 0, ["Rational", 1, 2]]],
        ],
        expected: ["List", ["List", ["Rational", 9, 4], 3], ["List", 2, ["Rational", 9, 4]]],
        category: "Scope",
        caption: "$L_2(x) = x^2 + 2$ threads element-wise over a matrix argument",
      },
      {
        expr: [
          "Subtract",
          ["Power", ["LucasL", 10], 2],
          ["Multiply", 5, ["Power", ["Fibonacci", 10], 2]],
        ],
        expected: 4,
        category: "Properties",
        caption: "$L_n^2 - 5F_n^2 = 4(-1)^n$, here at $n = 10$. See [[Fibonacci]]",
      },
      {
        expr: ["Equal", ["LucasL", 6], ["Add", ["Fibonacci", 5], ["Fibonacci", 7]]],
        expected: "True",
        category: "Properties",
        caption: "$L_n = F_{n-1} + F_{n+1}$, here at $n = 6$",
      },
      {
        expr: ["Equal", ["Fibonacci", 6], ["Divide", ["Add", ["LucasL", 5], ["LucasL", 7]], 5]],
        expected: "True",
        category: "Properties",
        caption: "Conversely $F_n = \\dfrac{L_{n-1} + L_{n+1}}{5}$",
      },
      {
        expr: ["Subtract", ["Multiply", ["LucasL", 4], ["LucasL", 6]], ["Power", ["LucasL", 5], 2]],
        expected: 5,
        category: "Properties",
        caption: "A Cassini-style identity $L_{n-1}L_{n+1} - L_n^2 = 5(-1)^{n+1}$, here at $n = 5$",
      },
      {
        expr: ["LucasL", -1],
        expected: -1,
        category: "Properties",
        caption: "Negative indices are supported via $L_{-n} = (-1)^n L_n$",
      },
      {
        expr: ["Divide", ["LucasL", 15], ["LucasL", 14]],
        expected: ["Rational", 1364, 843],
        category: "Applications",
        caption:
          "Consecutive ratios $L_{n+1}/L_n$ converge to the golden ratio too. See [[Fibonacci]]",
      },
      {
        expr: ["LucasL", ["List", 1, 2, 3, 4]],
        expected: ["List", 1, 3, 4, 7],
        category: "Scope",
        caption: "Threads element-wise over a list, as Wolfram's Listable heads do",
      },
      {
        expr: ["LucasL", 30],
        expected: 1860498,
        category: "Neat examples",
        caption: "$L_{30}$ already tops 1.8 million, growing at the same rate as [[Fibonacci]]",
      },
    ],
    seeAlso: ["Fibonacci"],
  },
  {
    name: "BernoulliB",
    domain: "Sequences",
    signature: "BernoulliB(n, x?)",
    summary:
      "The nth Bernoulli number, a rational sequence appearing in power-sum (Faulhaber) formulas and series expansions.",
    signatures: [
      { call: "BernoulliB(n)", description: "the nth Bernoulli number $B_n$." },
      {
        call: "BernoulliB(n, x)",
        description: "the Bernoulli polynomial $B_n(x)$.",
        library: "@enumeratio/analytic",
      },
    ],
    details: [
      "Defined by the generating function $\\dfrac{t}{e^t-1} = \\sum_{n=0}^{\\infty} B_n \\dfrac{t^n}{n!}$.",
      '$B_n = 0$ for every odd $n > 1$; $B_1 = -\\frac12$ under this (the "$B_n^-$") convention.',
      "Drive Faulhaber's formula for power sums, $\\sum_{k=0}^{n-1} k^p = \\frac{1}{p+1}\\sum_{j=0}^{p}\\binom{p+1}{j} B_j\\, n^{p+1-j}$. See [[Binomial]].",
      "Related to the Riemann zeta function: $\\zeta(-n) = -\\dfrac{B_{n+1}}{n+1}$ for $n \\ge 1$, and $\\zeta(2n) = \\dfrac{(-1)^{n+1} B_{2n} (2\\pi)^{2n}}{2\\,(2n)!}$.",
      "compute-engine only defines $B_n$ for nonnegative integer $n$. With a second argument, BernoulliB(n, x) is the Bernoulli polynomial $B_n(x)$, as in Wolfram — the same as [[BernoulliPolynomial]].",
    ],
    examples: [
      { expr: ["BernoulliB", 0], expected: 1 },
      { expr: ["BernoulliB", 1], expected: ["Rational", -1, 2] },
      { expr: ["BernoulliB", 2], expected: ["Rational", 1, 6] },
      { expr: ["BernoulliB", 4], expected: ["Rational", -1, 30] },
      { expr: ["BernoulliB", 12], expected: ["Rational", -691, 2730] },
      { expr: ["BernoulliB", 10], expected: ["Rational", 5, 66] },
      {
        expr: ["BernoulliB", 60],
        expected: ["Rational", { num: "-1215233140483755572040304994079820246041491" }, 56786730],
        category: "Scope",
        caption: "Exact rationals at any index",
      },
      {
        expr: ["BernoulliB", ["List", 2, 4, 6]],
        expected: ["List", ["Rational", 1, 6], ["Rational", -1, 30], ["Rational", 1, 42]],
        category: "Scope",
        caption: "Listable: $B_n$ threads over a list of indices",
      },
      {
        expr: ["BernoulliB", 4, "x"],
        expected: [
          "Add",
          ["Power", "x", 4],
          ["Multiply", -2, ["Power", "x", 3]],
          ["Power", "x", 2],
          ["Rational", -1, 30],
        ],
        category: "Scope",
        caption: "The Bernoulli polynomial $B_4(x) = x^4 - 2x^3 + x^2 - \\frac{1}{30}$",
      },
      {
        expr: ["BernoulliB", 2, ["Rational", 1, 2]],
        expected: ["Rational", -1, 12],

        category: "Scope",
        caption: "The Bernoulli polynomial at a rational point: $B_2(\\frac12) = -\\frac{1}{12}$",
      },
      {
        expr: ["BernoulliB", 1, 1],
        expected: ["Rational", 1, 2],
        category: "Possible issues",
        caption: "$B_1(1) = +\\frac12$ is the other convention for $B_1$",
      },
      {
        expr: ["Denominator", ["BernoulliB", 12]],
        expected: 2730,
        category: "Properties",
        caption:
          "von Staudt–Clausen: the denominator of $B_{2n}$ is the product of the primes $p$ with $(p-1) \\mid 2n$, here $2 \\cdot 3 \\cdot 5 \\cdot 7 \\cdot 13$",
      },
      {
        expr: ["Equal", ["Zeta", -3], ["Negate", ["Divide", ["BernoulliB", 4], 4]]],
        expected: "True",
        category: "Properties",
        caption:
          "$\\zeta(-n) = -\\frac{B_{n+1}}{n+1}$, here $\\zeta(-3) = \\frac{1}{120}$. See [[Zeta]]",
      },
      {
        expr: [
          "Add",
          ["Multiply", ["Binomial", 5, 0], ["BernoulliB", 0]],
          ["Multiply", ["Binomial", 5, 1], ["BernoulliB", 1]],
          ["Multiply", ["Binomial", 5, 2], ["BernoulliB", 2]],
          ["Multiply", ["Binomial", 5, 3], ["BernoulliB", 3]],
          ["Multiply", ["Binomial", 5, 4], ["BernoulliB", 4]],
        ],
        expected: 0,
        category: "Properties",
        caption: "The recurrence $\\sum_{k=0}^{n-1} \\binom{n}{k} B_k = 0$, here at $n = 5$",
      },
      {
        expr: ["Equal", ["BernoulliB", 5], 0],
        expected: "True",
        category: "Properties",
        caption: "$B_n = 0$ for every odd $n > 1$",
      },
      {
        expr: [
          "Divide",
          [
            "Add",
            ["Multiply", ["Binomial", 3, 0], ["BernoulliB", 0], ["Power", 5, 3]],
            ["Multiply", ["Binomial", 3, 1], ["BernoulliB", 1], ["Power", 5, 2]],
            ["Multiply", ["Binomial", 3, 2], ["BernoulliB", 2], ["Power", 5, 1]],
          ],
          3,
        ],
        expected: 30,
        category: "Applications",
        caption:
          "Faulhaber's formula recovers $\\sum_{k=0}^{4} k^2 = 30$ from $B_0, B_1, B_2$ weighted by $\\binom{3}{j}$. See [[Binomial]]",
      },
      {
        expr: ["BernoulliB", -1],
        expected: ["BernoulliB", -1],
        category: "Possible issues",
        caption:
          "Bernoulli numbers are only defined for $n \\ge 0$; a negative index is left unevaluated",
      },
      {
        expr: ["BernoulliB", 1, "x"],
        expected: ["Add", "x", ["Rational", -1, 2]],
        category: "Scope",
        caption:
          "With a second argument, the Bernoulli polynomial $B_n(x)$ — [[BernoulliPolynomial]] under Wolfram's name",
      },
      {
        expr: ["BernoulliB", ["List", 1, 2, 3]],
        expected: ["List", ["Rational", -1, 2], ["Rational", 1, 6], 0],
        category: "Scope",
        caption: "Threads element-wise over a list, as Wolfram's Listable heads do",
      },
      {
        expr: ["BernoulliB", 20],
        expected: ["Rational", -174611, 330],
        category: "Neat examples",
        caption: "Numerators and denominators grow quickly: $B_{20} = -\\frac{174611}{330}$",
      },
    ],
  },
];
