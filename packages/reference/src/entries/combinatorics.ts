import type { ReferenceEntry } from "../types.ts";

// Every `expected` was produced by evaluating `expr` with compute-engine 0.128.0
// (the reference tests re-evaluate and pin it). See sibling domain files.
export const combinatorics: readonly ReferenceEntry[] = [
  {
    name: "Binomial",
    domain: "Combinatorics",
    signature: "Binomial(n, k)",
    summary:
      "The binomial coefficient $\\binom{n}{k}$, the number of k-element subsets of an n-element set.",
    signatures: [
      { call: "Binomial(n, k)", description: "the binomial coefficient $\\binom{n}{k}$." },
    ],
    details: [
      "The general definition runs through the Gamma function: $\\binom{n}{k} = \\frac{\\Gamma(n+1)}{\\Gamma(k+1)\\,\\Gamma(n-k+1)}$.",
      "Symmetric in its arguments: $\\binom{n}{k} = \\binom{n}{n-k}$.",
      "Pascal's rule builds each row from the last: $\\binom{n}{k} = \\binom{n-1}{k-1} + \\binom{n-1}{k}$.",
      "Row sums give $\\sum_{k=0}^{n} \\binom{n}{k} = 2^n$.",
      "compute-engine evaluates only integer n and k: k outside $[0, n]$ gives 0 for nonnegative n, while a negative n switches to the generalized falling-factorial formula rather than the Gamma form.",
    ],
    examples: [
      { expr: ["Binomial", 5, 2], expected: 10 },
      { expr: ["Binomial", 10, 3], expected: 120 },
      { expr: ["Binomial", 4, 2], expected: 6 },
      { expr: ["Binomial", 5, 0], expected: 1, caption: "Choosing none of n is always 1 way" },
      { expr: ["Binomial", 5, 5], expected: 1, caption: "Choosing all of n is always 1 way" },
      {
        expr: ["Equal", ["Binomial", 10, 3], ["Binomial", 10, 7]],
        expected: "True",
        category: "Properties",
        caption: "Symmetry: $\\binom{n}{k} = \\binom{n}{n-k}$",
      },
      {
        expr: ["Equal", ["Add", ["Binomial", 9, 2], ["Binomial", 9, 3]], ["Binomial", 10, 3]],
        expected: "True",
        category: "Properties",
        caption: "Pascal's rule: $\\binom{n-1}{k-1} + \\binom{n-1}{k} = \\binom{n}{k}$",
      },
      {
        expr: [
          "Equal",
          [
            "Add",
            ["Binomial", 4, 0],
            ["Binomial", 4, 1],
            ["Binomial", 4, 2],
            ["Binomial", 4, 3],
            ["Binomial", 4, 4],
          ],
          ["Power", 2, 4],
        ],
        expected: "True",
        category: "Properties",
        caption: "Row sums give $\\sum_k \\binom{n}{k} = 2^n$, here at $n = 4$",
      },
      {
        expr: ["Binomial", 52, 5],
        expected: 2598960,
        category: "Applications",
        caption: "The number of distinct 5-card hands dealt from a standard 52-card deck",
      },
      {
        expr: ["Binomial", 5, 7],
        expected: 0,
        category: "Possible issues",
        caption: "Choosing more elements than available ($k > n$) gives 0, not an error",
      },
      {
        expr: ["Binomial", 5, -1],
        expected: 0,
        category: "Possible issues",
        caption: "A negative k also gives 0",
      },
      {
        expr: ["Binomial", -5, 2],
        expected: 15,
        category: "Possible issues",
        caption:
          "A negative n uses the generalized formula $\\binom{n}{k} = \\frac{n(n-1)\\cdots(n-k+1)}{k!}$ rather than 0",
      },
      {
        expr: ["Binomial", ["List", 2, 3, 5, 7, 11], 3],
        expected: ["List", 0, 1, 10, 35, 165],
        category: "Scope",
        caption: "Threads element-wise over a list, as Wolfram's Listable heads do",
      },
      {
        expr: ["Binomial", ["Rational", 9, 2], ["Rational", 7, 2]],
        expected: ["Rational", 9, 2],
        category: "Scope",
        caption:
          "Half-integer arguments evaluate exactly through the Gamma function: here $n - k = 1$, so the answer is just $n = \\frac{9}{2}$",
      },
    ],
    seeAlso: ["Factorial", "Multinomial", "Pochhammer"],
  },
  {
    name: "Multinomial",
    domain: "Combinatorics",
    signature: "Multinomial(k_1, k_2, …)",
    summary:
      "The multinomial coefficient $\\frac{(k_1 + k_2 + \\cdots)!}{k_1!\\,k_2!\\cdots}$ generalises [[Binomial]] to more than two parts.",
    signatures: [
      {
        call: "Multinomial(k_1, k_2, ...)",
        description: "the multinomial coefficient for parts $k_1, k_2, \\ldots$",
      },
    ],
    details: [
      "Counts the ways to split $k_1 + k_2 + \\cdots$ labeled items into groups of the given sizes.",
      "With two arguments it reduces to [[Binomial]]: $\\binom{k_1+k_2}{k_1}$.",
      "Orderless: permuting the arguments doesn't change the value.",
      "All-zero arguments and a single argument both reduce to the empty product, 1.",
      "compute-engine requires all-integer arguments; a list argument is threaded over element-wise, as Wolfram's Listable heads do.",
    ],
    examples: [
      { expr: ["Multinomial", 1, 2, 1], expected: 12 },
      { expr: ["Multinomial", 2, 3, 4], expected: 1260 },
      {
        expr: ["Equal", ["Multinomial", 7, 3], ["Binomial", 10, 3]],
        expected: "True",
        category: "Properties",
        caption: "With two arguments it reduces to [[Binomial]]: $\\binom{n_1+n_2}{n_1}$",
      },
      {
        expr: ["Equal", ["Multinomial", 1, 2, 3], ["Multinomial", 3, 1, 2]],
        expected: "True",
        category: "Properties",
        caption: "Orderless: permuting the arguments doesn't change the value",
      },
      {
        expr: ["Multinomial", 1, 4, 4, 2],
        expected: 34650,
        category: "Applications",
        caption:
          "The number of distinct letter arrangements of MISSISSIPPI: 1 M, 4 I's, 4 S's, 2 P's",
      },
      {
        expr: ["Multinomial", 0, 0, 0],
        expected: 1,
        category: "Possible issues",
        caption: "All-zero arguments still give the empty product, 1",
      },
      {
        expr: ["Multinomial", 5],
        expected: 1,
        category: "Possible issues",
        caption:
          "A single argument is always 1: there's only one way to split n items into one group",
      },
      {
        expr: ["Multinomial", ["List", 2, 3, 5], 3],
        expected: ["List", 10, 20, 56],
        category: "Scope",
        caption: "Threads element-wise over a list, as Wolfram's Listable heads do",
      },
    ],
    seeAlso: ["Binomial", "Factorial"],
  },
  {
    name: "Factorial",
    domain: "Combinatorics",
    signature: "Factorial(n)",
    summary: "The product of the positive integers up to n, written n!.",
    signatures: [
      { call: "Factorial(n)", description: "$n!$, the product of the integers from 1 to n." },
    ],
    details: [
      "$0! = 1$ by convention, the empty product.",
      "Recurrence: $n! = n\\,(n-1)!$.",
      "Extends to non-integers via the Gamma function, $n! = \\Gamma(n+1)$, so half-integer factorials involve $\\sqrt{\\pi}$.",
      "Grows faster than any exponential; Stirling's approximation $n! \\sim \\sqrt{2\\pi n}\\,(n/e)^n$ describes the asymptotics.",
      "compute-engine returns ComplexInfinity at negative integers, the poles of Gamma, rather than leaving the expression unevaluated.",
    ],
    examples: [
      { expr: ["Factorial", 5], expected: 120 },
      { expr: ["Factorial", 6], expected: 720 },
      { expr: ["Factorial", 0], expected: 1, caption: "The empty product is 1 by convention" },
      { expr: ["Factorial", 10], expected: 3628800 },
      {
        expr: ["Factorial", ["List", 1, 2, 3, 4]],
        expected: ["List", 1, 2, 6, 24],
        caption: "Threads element-wise over a list",
      },
      {
        expr: ["Equal", ["Factorial", 5], ["Multiply", 5, ["Factorial", 4]]],
        expected: "True",
        category: "Properties",
        caption: "Recurrence: $n! = n\\,(n-1)!$",
      },
      {
        expr: ["Factorial", ["Rational", 1, 2]],
        expected: 0.8862269254527586,
        category: "Properties",
        caption:
          "Extends to non-integers via the Gamma function: $\\left(\\frac12\\right)! = \\Gamma\\!\\left(\\frac32\\right) = \\frac{\\sqrt{\\pi}}{2}$",
      },
      {
        expr: ["Factorial", 8],
        expected: 40320,
        category: "Applications",
        caption: "The number of ways to arrange 8 distinct books on a shelf",
      },
      {
        expr: ["Factorial", -1],
        expected: "ComplexInfinity",
        category: "Possible issues",
        caption:
          "Negative integers are poles of the Gamma function, so this returns ComplexInfinity rather than staying unevaluated",
      },
      {
        expr: ["Factorial", 20],
        expected: 2432902008176640000,
        category: "Neat examples",
        caption: "Factorials grow fast: $20!$ already exceeds $2 \\times 10^{18}$",
      },
      {
        expr: ["Simplify", ["Divide", ["Factorial", "n"], ["Factorial", ["Subtract", "n", 1]]]],
        expected: "n",
        category: "Scope",
        caption:
          "$\\frac{n!}{(n-1)!}$ simplifies to $n$. Plain evaluation leaves the ratio standing, as Wolfram's does",
      },
    ],
    seeAlso: ["Binomial", "Factorial2", "Subfactorial", "Pochhammer"],
  },
  {
    name: "Factorial2",
    domain: "Combinatorics",
    signature: "Factorial2(n)",
    summary:
      "The double factorial $n!!$, the product of every second integer from n down to 1 or 2.",
    signatures: [{ call: "Factorial2(n)", description: "the double factorial $n!!$." }],
    details: [
      "Skips every other factor: $n!! = n(n-2)(n-4)\\cdots$, stopping at 1 (n odd) or 2 (n even).",
      "Recurrence: $n!! = n\\,(n-2)!!$, with $0!! = 1$.",
      "Splits an ordinary factorial into its even and odd parts: $n! = n!!\\,(n-1)!!$.",
      "$(2n-1)!!$ counts the perfect matchings of $2n$ objects into pairs.",
      "The recurrence run downwards extends it to negative odd integers, $(-2k-1)!! = \\dfrac{(-1)^k}{(2k-1)!!}$; at negative even integers it hits a pole (a division by the $0!!$ term) and returns NaN.",
    ],
    examples: [
      { expr: ["Factorial2", 7], expected: 105, caption: "7 × 5 × 3 × 1" },
      { expr: ["Factorial2", 8], expected: 384, caption: "8 × 6 × 4 × 2" },
      { expr: ["Factorial2", 10], expected: 3840 },
      { expr: ["Factorial2", 0], expected: 1 },
      {
        expr: ["Equal", ["Factorial", 8], ["Multiply", ["Factorial2", 8], ["Factorial2", 7]]],
        expected: "True",
        category: "Properties",
        caption: "Splits an ordinary factorial into even and odd parts: $n! = n!!\\,(n-1)!!$",
      },
      {
        expr: ["Factorial2", 9],
        expected: 945,
        category: "Applications",
        caption:
          "The number of ways to pair up 10 people into 5 couples: $(2n-1)!!$ counts perfect matchings of $2n$ objects",
      },
      {
        expr: ["Factorial2", -2],
        expected: "NaN",
        category: "Possible issues",
        caption:
          "Negative even arguments hit a pole in the recurrence (the $(0)!!/0$ term is undefined), so compute-engine returns NaN",
        divergence: {
          wolfram:
            "The pole at a negative even argument is NaN here and ComplexInfinity in Wolfram.",
        },
      },
      {
        expr: ["Factorial2", 15],
        expected: 2027025,
        category: "Neat examples",
        caption:
          "$15!! = 2{,}027{,}025$, already past two million despite skipping every other factor",
      },
      {
        expr: ["Factorial2", -1],
        expected: 1,
        category: "Scope",
        caption:
          "The recurrence $n!! = n \\cdot (n-2)!!$ run downwards extends it to negative odd integers: $(-1)!! = 1$, $(-3)!! = -1$, $(-5)!! = \\frac{1}{3}$",
      },
    ],
    seeAlso: ["Factorial"],
  },
  {
    // GOLD TEMPLATE: a thorough entry showing every feature -- categorized
    // categories, inline $latex$, [[cross-links]], real Properties, and
    // aspirational capability gaps. New entries should aim for this shape.
    name: "CatalanNumber",
    domain: "Combinatorics",
    signature: "CatalanNumber(n)",
    summary:
      "The nth Catalan number $C_n$, counting balanced bracket sequences, binary trees, polygon triangulations, and many other structures of size n.",
    signatures: [{ call: "CatalanNumber(n)", description: "the nth Catalan number $C_n$." }],
    details: [
      "The Catalan numbers have the closed form $C_n = \\frac{1}{n+1}\\binom{2n}{n}$.",
      "They satisfy the recurrence $C_{n+1} = \\sum_{i=0}^{n} C_i\\,C_{n-i}$ with $C_0 = 1$.",
      "$C_n$ is the number of monotonic lattice paths from one corner of an $n \\times n$ grid to the opposite corner that stay below the diagonal.",
      "compute-engine defines $C_n$ on nonnegative integers; half-integers evaluate exactly through $C_n = \\frac{\\Gamma(2n+1)}{\\Gamma(n+1)\\,\\Gamma(n+2)}$, and other real and complex arguments are not yet supported.",
    ],
    examples: [
      { expr: ["CatalanNumber", 0], expected: 1 },
      { expr: ["CatalanNumber", 1], expected: 1 },
      { expr: ["CatalanNumber", 5], expected: 42 },
      { expr: ["CatalanNumber", 10], expected: 16796 },
      {
        expr: ["Divide", ["Binomial", ["Multiply", 2, 5], 5], ["Add", 5, 1]],
        expected: 42,
        category: "Properties",
        caption: "Closed form $C_n = \\frac{1}{n+1}\\binom{2n}{n}$, here at $n = 5$",
      },
      {
        expr: ["Subtract", ["Binomial", 10, 5], ["Binomial", 10, 6]],
        expected: 42,
        category: "Properties",
        caption: "Equivalently $C_n = \\binom{2n}{n} - \\binom{2n}{n+1}$",
      },
      {
        expr: ["Divide", ["CatalanNumber", 6], ["CatalanNumber", 5]],
        expected: ["Rational", 22, 7],
        category: "Properties",
        caption: "The consecutive ratio is $\\frac{C_{n+1}}{C_n} = \\frac{2(2n+1)}{n+2}$",
      },
      {
        expr: ["CatalanNumber", 3],
        expected: 5,
        category: "Applications",
        caption: "The 5 ways to balance 3 pairs of parentheses",
      },
      {
        expr: ["CatalanNumber", 4],
        expected: 14,
        category: "Applications",
        caption:
          "The 14 triangulations of a hexagon, and the 14 binary trees with 4 leaves. See [[Binomial]]",
      },
      {
        expr: ["CatalanNumber", -1],
        expected: ["CatalanNumber", -1],
        category: "Possible issues",
        caption: "A negative argument is left unevaluated",
        divergence: {
          wolfram:
            "A negative index is left unevaluated here; Wolfram extends CatalanNumber through Gamma and gives C(-1) = -1.",
        },
      },
      {
        expr: ["CatalanNumber", 15],
        expected: 9694845,
        category: "Neat examples",
        caption: "They grow fast: $C_{15}$ already passes nine million",
      },
      {
        expr: ["CatalanNumber", ["List", 1, 2, 3, 4]],
        expected: ["List", 1, 2, 5, 14],
        category: "Scope",
        caption: "Threads element-wise over a list, as Wolfram's Listable heads do",
      },
      {
        expr: ["CatalanNumber", ["Rational", 5, 2]],
        expected: ["Divide", 1024, ["Multiply", 105, "Pi"]],
        category: "Scope",
        caption:
          "Half-integer arguments evaluate exactly through $C_n = \\frac{\\Gamma(2n+1)}{\\Gamma(n+1)\\,\\Gamma(n+2)}$",
      },
    ],
    seeAlso: ["Binomial", "BellNumber"],
  },
  {
    name: "Pochhammer",
    domain: "Combinatorics",
    signature: "Pochhammer(a, n)",
    summary: "The rising factorial (a)_n = a(a+1)(a+2)…(a+n−1).",
    signatures: [{ call: "Pochhammer(a, n)", description: "the rising factorial $(a)_n$." }],
    details: [
      "Closed form via the Gamma function: $(a)_n = \\frac{\\Gamma(a+n)}{\\Gamma(a)}$.",
      "$(1)_n = n!$, since the rising factorial from 1 just counts up to n.",
      "Negative order gives the falling reciprocal: $(a)_{-n} = \\frac{1}{(a-1)(a-2)\\cdots(a-n)}$.",
      "Dividing by $k!$ counts multisets: $\\binom{n+k-1}{k} = \\frac{(n)_k}{k!}$.",
      "If a is a non-positive integer with $|a| < n$, the product picks up a zero factor and vanishes.",
      "A building block of hypergeometric series, where it appears in both numerator and denominator terms.",
    ],
    examples: [
      { expr: ["Pochhammer", 5, 3], expected: 210, caption: "5 × 6 × 7" },
      { expr: ["Pochhammer", 2, 0], expected: 1, caption: "An empty product is 1" },
      { expr: ["Pochhammer", 1, 5], expected: 120, caption: "(1)_5 equals 5!" },
      { expr: ["Pochhammer", 3, 4], expected: 360 },
      {
        expr: ["Equal", ["Pochhammer", 1, 5], ["Factorial", 5]],
        expected: "True",
        category: "Properties",
        caption: "$(1)_n = n!$, since the rising factorial from 1 just counts up to n",
      },
      {
        expr: ["Pochhammer", 5, -2],
        expected: ["Rational", 1, 12],
        category: "Properties",
        caption:
          "Negative order gives the reciprocal: $(a)_{-n} = \\frac{1}{(a-1)(a-2)\\cdots(a-n)}$, so $(5)_{-2} = \\frac{1}{4\\cdot3}$",
      },
      {
        expr: ["Divide", ["Pochhammer", 5, 3], ["Factorial", 3]],
        expected: 35,
        category: "Applications",
        caption:
          "Dividing by $k!$ counts multisets: $\\binom{n+k-1}{k} = \\frac{(n)_k}{k!}$, here choosing 3 items from 5 types with repetition",
      },
      {
        expr: ["Pochhammer", -3, 4],
        expected: 0,
        category: "Possible issues",
        caption:
          "If a is a non-positive integer with $|a| < n$, the product picks up a zero factor: $(-3)(-2)(-1)(0)$",
      },
      {
        expr: ["Pochhammer", ["List", 2, 3, 4], 2],
        expected: ["List", 6, 12, 20],
        category: "Scope",
        caption: "Threads element-wise over a list, as Wolfram's Listable heads do",
      },
    ],
    seeAlso: ["Factorial", "Binomial"],
  },
  {
    name: "Subfactorial",
    domain: "Combinatorics",
    signature: "Subfactorial(n)",
    summary:
      "The number of derangements of n objects: permutations that leave no element in its original position.",
    signatures: [
      { call: "Subfactorial(n)", description: "the number of derangements $D_n$ of n objects." },
    ],
    details: [
      "Closed form $D_n = n! \\sum_{k=0}^{n} \\frac{(-1)^k}{k!}$, so $D_n$ is n! divided by e and rounded to the nearest integer.",
      "Recurrence: $D_n = n\\,D_{n-1} + (-1)^n$, with $D_0 = 1$.",
      "Also satisfies the two-term recurrence $D_{n+1} = n\\,(D_n + D_{n-1})$.",
      "The classic hat-check problem: $D_n$ counts the ways n people can have their hats returned so nobody gets their own.",
      "compute-engine leaves negative arguments unevaluated rather than extending Subfactorial analytically.",
    ],
    examples: [
      { expr: ["Subfactorial", 0], expected: 1 },
      { expr: ["Subfactorial", 1], expected: 0, caption: "A single object can't be deranged" },
      { expr: ["Subfactorial", 4], expected: 9 },
      { expr: ["Subfactorial", 5], expected: 44 },
      {
        expr: [
          "Equal",
          ["Subfactorial", 4],
          ["Add", ["Multiply", 4, ["Subfactorial", 3]], ["Power", -1, 4]],
        ],
        expected: "True",
        category: "Properties",
        caption: "Recurrence: $D_n = n D_{n-1} + (-1)^n$",
      },
      {
        expr: ["Subfactorial", 6],
        expected: 265,
        category: "Applications",
        caption:
          "The hat-check problem: the number of ways 6 people can have their hats returned so nobody gets their own",
      },
      {
        expr: ["Subfactorial", -1],
        expected: ["Subfactorial", -1],
        category: "Possible issues",
        caption: "A negative argument is left unevaluated",
      },
      {
        expr: ["Subfactorial", ["List", 1, 2, 3, 4]],
        expected: ["List", 0, 1, 2, 9],
        category: "Scope",
        caption: "Threads element-wise over a list, as Wolfram's Listable heads do",
      },
    ],
    seeAlso: ["Factorial"],
  },
  {
    name: "StirlingS1",
    domain: "Combinatorics",
    signature: "StirlingS1(n, k)",
    summary:
      "The signed Stirling number of the first kind, relating falling factorials to powers of n.",
    signatures: [
      {
        call: "StirlingS1(n, k)",
        description: "the signed Stirling number of the first kind $s(n, k)$.",
      },
    ],
    details: [
      "Coefficients relating falling factorials to ordinary powers: $(x)_n = \\sum_{k} s(n, k)\\, x^k$.",
      "$|s(n, k)|$ counts the permutations of n elements with exactly k cycles.",
      "$s(n, n) = 1$ and $s(n, 0) = 0$ for $n > 0$, with the boundary case $s(0, 0) = 1$.",
      "The unsigned values in each row sum to $n!$: $\\sum_k |s(n, k)| = n!$",
      "$s(n, 1) = (-1)^{n-1}(n-1)!$.",
      "Threads element-wise over a list of $n$, as Wolfram's Listable heads do.",
    ],
    examples: [
      { expr: ["StirlingS1", 5, 2], expected: -50 },
      { expr: ["StirlingS1", 4, 2], expected: 11 },
      { expr: ["StirlingS1", 3, 3], expected: 1, caption: "s(n, n) is always 1" },
      { expr: ["StirlingS1", 5, 0], expected: 0, caption: "s(n, 0) is 0 for n > 0" },
      {
        expr: [
          "Equal",
          ["Sum", ["Abs", ["StirlingS1", 4, "k"]], ["Tuple", "k", 0, 4]],
          ["Factorial", 4],
        ],
        expected: "True",
        category: "Properties",
        caption: "The unsigned values in a row sum to $n!$",
      },
      {
        expr: ["StirlingS1", 5, 3],
        expected: 35,
        category: "Applications",
        caption:
          "The number of permutations of 5 elements with exactly 3 cycles is $|s(5, 3)| = 35$",
      },
      {
        expr: ["StirlingS1", 0, 0],
        expected: 1,
        category: "Possible issues",
        caption:
          "The empty case $s(0, 0) = 1$ by convention, distinct from $s(n, 0) = 0$ for $n > 0$",
      },
      {
        expr: ["StirlingS1", 10, 1],
        expected: -362880,
        category: "Neat examples",
        caption: "$s(n, 1) = (-1)^{n-1}(n-1)!$, so $s(10, 1) = -9!$",
      },
      {
        expr: ["StirlingS1", ["List", 2, 4, 6], 2],
        expected: ["List", 1, 11, 274],
        category: "Scope",
        caption: "Threads element-wise over a list, as Wolfram's Listable heads do",
      },
    ],
    seeAlso: ["Binomial", "Stirling"],
  },
  {
    name: "Stirling",
    domain: "Combinatorics",
    signature: "Stirling(n, k)",
    summary:
      "The Stirling number of the second kind $S(n, k)$: the number of ways to partition an n-set into k non-empty blocks",
    signatures: [
      {
        call: "Stirling(n, k)",
        description: "the number of partitions of an $n$-set into $k$ blocks",
      },
    ],
    details: [
      "compute-engine spells the second-kind number $\\left\\{{n\\atop k}\\right\\}$ as $\\mathrm{Stirling}$.",
      "It satisfies the recurrence $S(n, k) = k\\,S(n-1, k) + S(n-1, k-1)$",
      "Summing over $k$ gives the Bell number: $\\sum_k S(n, k) = B_n$ (see [[BellNumber]])",
      "The signed first-kind numbers are [[StirlingS1]]",
    ],
    examples: [
      { expr: ["Stirling", 5, 2], expected: 15 },
      { expr: ["Stirling", 6, 3], expected: 90 },
      {
        expr: ["Stirling", 5, 1],
        expected: 1,
        category: "Properties",
        caption: "One block means one partition: $S(n, 1) = 1$",
      },
      {
        expr: ["Stirling", 5, 5],
        expected: 1,
        category: "Properties",
        caption: "Singletons only: $S(n, n) = 1$",
      },
      {
        expr: ["Equal", ["Sum", ["Stirling", 4, "k"], ["Tuple", "k", 0, 4]], ["BellNumber", 4]],
        expected: "True",
        category: "Properties",
        caption: "Row sums give the Bell numbers",
      },
      {
        expr: ["Stirling", 0, 0],
        expected: 1,
        category: "Possible issues",
        caption: "The empty set has one partition (into no blocks)",
      },
    ],
    seeAlso: ["StirlingS1", "BellNumber", "SetPartitions"],
  },
  {
    name: "BellNumber",
    domain: "Combinatorics",
    signature: "BellNumber(n)",
    summary: "The nth Bell number, counting the ways to partition a set of n elements.",
    signatures: [
      {
        call: "BellNumber(n)",
        description: "the nth Bell number $B_n$, the number of partitions of an n-element set.",
      },
    ],
    details: [
      "Recurrence $B_{n+1} = \\sum_{k=0}^{n} \\binom{n}{k}\\, B_k$, built from [[Binomial]] and the lower Bell numbers.",
      "Generating function $\\sum_{n} B_n \\frac{t^n}{n!} = e^{e^t - 1}$.",
      "Equals the sum of Stirling numbers of the second kind over all block counts, $B_n = \\sum_{k=0}^{n} S(n, k)$.",
      "Also arise as the nth moment of a Poisson distribution with mean 1.",
      "compute-engine requires a nonnegative integer argument; a negative n is left unevaluated.",
    ],
    examples: [
      { expr: ["BellNumber", 0], expected: 1 },
      { expr: ["BellNumber", 1], expected: 1 },
      { expr: ["BellNumber", 3], expected: 5 },
      { expr: ["BellNumber", 5], expected: 52 },
      { expr: ["BellNumber", 10], expected: 115975 },
      {
        expr: [
          "Equal",
          ["BellNumber", 5],
          [
            "Add",
            ["Multiply", ["Binomial", 4, 0], ["BellNumber", 0]],
            ["Multiply", ["Binomial", 4, 1], ["BellNumber", 1]],
            ["Multiply", ["Binomial", 4, 2], ["BellNumber", 2]],
            ["Multiply", ["Binomial", 4, 3], ["BellNumber", 3]],
            ["Multiply", ["Binomial", 4, 4], ["BellNumber", 4]],
          ],
        ],
        expected: "True",
        category: "Properties",
        caption: "Recurrence: $B_{n+1} = \\sum_{k=0}^n \\binom{n}{k} B_k$, here at $n = 4$",
      },
      {
        expr: ["BellNumber", 4],
        expected: 15,
        category: "Applications",
        caption:
          "The number of ways to partition a 4-element set into non-empty, unlabeled subsets",
      },
      {
        expr: ["BellNumber", -1],
        expected: ["BellNumber", -1],
        category: "Possible issues",
        caption: "A negative argument is left unevaluated",
      },
      {
        expr: ["BellNumber", ["List", 1, 2, 3, 4]],
        expected: ["List", 1, 2, 5, 15],
        category: "Scope",
        caption: "Threads element-wise over a list, as Wolfram's Listable heads do",
      },
    ],
    seeAlso: ["StirlingS1"],
  },
];
