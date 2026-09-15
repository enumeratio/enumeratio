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
    signatures: [{ call: "Fibonacci(n)", description: "the nth Fibonacci number $F_n$." }],
    details: [
      "Defined by the recurrence $F_n = F_{n-1} + F_{n-2}$ with $F_0 = 0$, $F_1 = 1$.",
      "Closed form (Binet's formula): $F_n = \\frac{\\varphi^n - \\psi^n}{\\sqrt5}$, where $\\varphi = \\frac{1+\\sqrt5}{2}$ and $\\psi = \\frac{1-\\sqrt5}{2}$.",
      "Consecutive ratios $F_{n+1}/F_n$ converge to the golden ratio $\\varphi$. See [[LucasL]].",
      "GCD identity: $\\gcd(F_m, F_n) = F_{\\gcd(m,n)}$.",
      "Extends to negative n via $F_{-n} = (-1)^{n+1} F_n$.",
      "compute-engine only accepts a single integer index (no threading over a list, no complex $n$).",
    ],
    examples: [
      { expr: ["Fibonacci", 0], expected: 0 },
      { expr: ["Fibonacci", 1], expected: 1 },
      { expr: ["Fibonacci", 10], expected: 55 },
      { expr: ["Fibonacci", 20], expected: 6765 },
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
        aspirational: true,
        category: "Scope",
        caption:
          "compute-engine only accepts a single integer index; a list argument is not threaded",
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
    signatures: [{ call: "LucasL(n)", description: "the nth Lucas number $L_n$." }],
    details: [
      "Defined by the same recurrence as [[Fibonacci]], $L_n = L_{n-1} + L_{n-2}$, but started from $L_0 = 2$, $L_1 = 1$.",
      "Closed form: $L_n = \\varphi^n + \\psi^n$, where $\\varphi = \\frac{1+\\sqrt5}{2}$ and $\\psi = \\frac{1-\\sqrt5}{2}$.",
      "Related to Fibonacci by $L_n = F_{n-1} + F_{n+1}$ and, conversely, $F_n = \\dfrac{L_{n-1} + L_{n+1}}{5}$.",
      "Consecutive ratios $L_{n+1}/L_n$ converge to the golden ratio, just as they do for [[Fibonacci]].",
      "Extends to negative n via $L_{-n} = (-1)^n L_n$.",
      "compute-engine only accepts a single integer index (no threading over a list, no complex $n$).",
    ],
    examples: [
      { expr: ["LucasL", 0], expected: 2 },
      { expr: ["LucasL", 1], expected: 1 },
      { expr: ["LucasL", 5], expected: 11 },
      { expr: ["LucasL", 10], expected: 123 },
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
        aspirational: true,
        category: "Scope",
        caption:
          "compute-engine only accepts a single integer index; a list argument is not threaded",
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
    signature: "BernoulliB(n)",
    summary:
      "The nth Bernoulli number, a rational sequence appearing in power-sum (Faulhaber) formulas and series expansions.",
    signatures: [{ call: "BernoulliB(n)", description: "the nth Bernoulli number $B_n$." }],
    details: [
      "Defined by the generating function $\\dfrac{t}{e^t-1} = \\sum_{n=0}^{\\infty} B_n \\dfrac{t^n}{n!}$.",
      '$B_n = 0$ for every odd $n > 1$; $B_1 = -\\frac12$ under this (the "$B_n^-$") convention.',
      "Drive Faulhaber's formula for power sums, $\\sum_{k=0}^{n-1} k^p = \\frac{1}{p+1}\\sum_{j=0}^{p}\\binom{p+1}{j} B_j\\, n^{p+1-j}$. See [[Binomial]].",
      "Related to the Riemann zeta function: $\\zeta(-n) = -\\dfrac{B_{n+1}}{n+1}$ for $n \\ge 1$, and $\\zeta(2n) = \\dfrac{(-1)^{n+1} B_{2n} (2\\pi)^{2n}}{2\\,(2n)!}$.",
      "compute-engine only defines $B_n$ for nonnegative integer $n$; the two-argument Bernoulli polynomial $B_n(x)$ is not yet supported.",
    ],
    examples: [
      { expr: ["BernoulliB", 0], expected: 1 },
      { expr: ["BernoulliB", 1], expected: ["Rational", -1, 2] },
      { expr: ["BernoulliB", 2], expected: ["Rational", 1, 6] },
      { expr: ["BernoulliB", 4], expected: ["Rational", -1, 30] },
      { expr: ["BernoulliB", 12], expected: ["Rational", -691, 2730] },
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
        expected: ["Subtract", "x", ["Rational", 1, 2]],
        aspirational: true,
        category: "Scope",
        caption:
          "The two-argument Bernoulli polynomial $B_1(x) = x - \\frac{1}{2}$ is not yet supported (only the numeric sequence)",
      },
      {
        expr: ["BernoulliB", ["List", 1, 2, 3]],
        expected: ["List", ["Rational", -1, 2], ["Rational", 1, 6], 0],
        aspirational: true,
        category: "Scope",
        caption: "compute-engine only accepts a single index; a list argument is not threaded",
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
