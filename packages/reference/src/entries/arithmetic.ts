import type { ReferenceEntry } from "../types.ts";

// Every `expected` was produced by evaluating `expr` with compute-engine 0.128.0
// (the reference tests re-evaluate and pin it). See sibling domain files.
export const arithmetic: readonly ReferenceEntry[] = [
  {
    name: "Abs",
    domain: "Arithmetic",
    signature: "Abs(x)",
    summary: "The absolute value or magnitude of x: $|x|$, its distance from 0.",
    signatures: [
      {
        call: "Abs(x)",
        description: "the absolute value $|x|$ of a real x, or the modulus of a complex number.",
      },
    ],
    details: [
      "For a real number, $|x| = x$ if $x \\ge 0$ and $|x| = -x$ if $x < 0$.",
      "For a complex number $a+bi$, $|a+bi| = \\sqrt{a^2+b^2}$, its distance from the origin.",
      "Always non-negative, with $|x| = 0$ exactly at $x = 0$.",
      "Satisfies the triangle inequality $|a+b| \\le |a| + |b|$.",
      "compute-engine doesn't factor constants out of a symbolic argument -- $|-3x|$ stays as written rather than simplifying to $3|x|$.",
    ],
    examples: [
      { expr: ["Abs", -5], expected: 5 },
      { expr: ["Abs", 5], expected: 5 },
      { expr: ["Abs", 0], expected: 0, caption: "0 is the only value with $|x| = 0$" },
      { expr: ["Abs", ["Rational", -7, 2]], expected: ["Rational", 7, 2] },
      {
        expr: ["Abs", ["Complex", 3, 4]],
        expected: 5,
        caption: "The modulus of a complex number: $|3+4i| = \\sqrt{3^2+4^2}$",
      },
      {
        expr: ["Abs", ["List", -1, 2, -3]],
        expected: ["List", 1, 2, 3],
        caption: "Threads element-wise over a list",
      },
      {
        expr: ["Equal", ["Abs", -8], ["Abs", 8]],
        expected: "True",
        category: "Properties",
        caption: "Even function: $|-x| = |x|$",
      },
      {
        expr: ["LessEqual", ["Abs", ["Add", 3, -8]], ["Add", ["Abs", 3], ["Abs", -8]]],
        expected: "True",
        category: "Properties",
        caption: "Triangle inequality: $|a+b| \\le |a| + |b|$",
      },
      {
        expr: ["Abs", ["Subtract", 70, 95]],
        expected: 25,
        category: "Applications",
        caption: "The gap between two temperatures, 70° and 95°, regardless of which is higher",
      },
      {
        expr: ["Abs", ["Multiply", -3, "x"]],
        expected: ["Abs", ["Multiply", -3, "x"]],
        category: "Possible issues",
        caption:
          "Doesn't factor constants out of a symbolic argument: $|-3x|$ stays as written rather than reducing to $3|x|$",
      },
    ],
    seeAlso: ["Sign", "Chop"],
  },
  {
    name: "Sign",
    domain: "Arithmetic",
    signature: "Sign(x)",
    summary: "The sign of x: -1, 0, or 1 for negative, zero, or positive x.",
    signatures: [
      {
        call: "Sign(x)",
        description: "-1, 0, or 1 for negative, zero, or positive real x; $z/|z|$ for complex z.",
      },
    ],
    details: [
      "$\\operatorname{sign}(x) = -1, 0, 1$ for $x < 0$, $x = 0$, $x > 0$ respectively.",
      "For a complex number, $\\operatorname{sign}(z) = z/|z|$, the unit complex number pointing toward z. See [[Abs]].",
      "Recovers the original magnitude: $x = |x|\\,\\operatorname{sign}(x)$.",
      "$\\operatorname{sign}(\\pm\\infty) = \\pm 1$, but $\\operatorname{sign}(\\mathrm{NaN})$ propagates as NaN rather than 0.",
    ],
    examples: [
      { expr: ["Sign", -3], expected: -1 },
      { expr: ["Sign", 3], expected: 1 },
      { expr: ["Sign", 0], expected: 0, caption: "Zero is its own sign" },
      { expr: ["Sign", ["Rational", -1, 2]], expected: -1 },
      {
        expr: ["Sign", ["Complex", 3, 4]],
        expected: ["Complex", ["Rational", 3, 5], ["Rational", 4, 5]],
        caption: "The unit complex number pointing the same direction as $3+4i$",
      },
      {
        expr: ["Sign", ["List", -3, 0, 7]],
        expected: ["List", -1, 0, 1],
        caption: "Threads element-wise over a list",
      },
      {
        expr: [
          "Equal",
          ["Sign", ["Complex", 3, 4]],
          ["Divide", ["Complex", 3, 4], ["Abs", ["Complex", 3, 4]]],
        ],
        expected: "True",
        category: "Properties",
        caption: "$\\operatorname{sign}(z) = z/|z|$. See [[Abs]]",
      },
      {
        expr: ["Equal", ["Multiply", -5, ["Sign", -5]], ["Abs", -5]],
        expected: "True",
        category: "Properties",
        caption: "$x \\cdot \\operatorname{sign}(x) = |x|$, here at $x = -5$",
      },
      {
        expr: ["Sign", ["Subtract", 70, 95]],
        expected: -1,
        category: "Applications",
        caption: "Tells you the temperature dropped, but not by how much -- for that, see [[Abs]]",
      },
      {
        expr: ["Sign", "NaN"],
        expected: "NaN",
        category: "Possible issues",
        caption: "NaN propagates rather than being treated as 0",
      },
    ],
    seeAlso: ["Abs", "Negate"],
  },
  {
    name: "Negate",
    domain: "Arithmetic",
    signature: "Negate(x)",
    summary: "The additive inverse of x: $-x$.",
    signatures: [{ call: "Negate(x)", description: "the additive inverse $-x$." }],
    details: [
      "The additive inverse: $\\operatorname{Negate}(x) = -x$.",
      "Double negation cancels: $-(-x) = x$.",
      "Distributes over a sum: $-(a+b) = -a - b$.",
      "Threads element-wise over a list.",
      "compute-engine keeps Negate as its own head rather than rewriting to $\\mathrm{Multiply}(-1, x)$.",
    ],
    examples: [
      { expr: ["Negate", 5], expected: -5 },
      { expr: ["Negate", -5], expected: 5 },
      { expr: ["Negate", 0], expected: 0, caption: "Its own negation" },
      { expr: ["Negate", ["Rational", 3, 4]], expected: ["Rational", -3, 4] },
      {
        expr: ["Negate", ["List", 1, -2, 3]],
        expected: ["List", -1, 2, -3],
        caption: "Threads element-wise over a list",
      },
      {
        expr: ["Negate", ["Negate", "x"]],
        expected: "x",
        category: "Properties",
        caption: "Double negation cancels: $-(-x) = x$",
      },
      {
        expr: ["Equal", ["Negate", ["Add", "a", "b"]], ["Add", ["Negate", "a"], ["Negate", "b"]]],
        expected: "True",
        category: "Properties",
        caption: "Distributes over a sum: $-(a+b) = -a - b$",
      },
      {
        expr: ["Negate", 42.5],
        expected: -42.5,
        category: "Applications",
        caption: "Recording a $42.50 charge as a negative balance adjustment",
      },
      {
        expr: ["Negate", "PositiveInfinity"],
        expected: "NegativeInfinity",
        category: "Possible issues",
        caption: "Flips signed infinities too",
      },
    ],
    seeAlso: ["Abs", "Sign"],
  },
  {
    name: "Square",
    domain: "Arithmetic",
    signature: "Square(x)",
    summary: "The second power of x: $x^2$.",
    signatures: [{ call: "Square(x)", description: "the second power $x^2$." }],
    details: [
      "Canonicalizes to $x^2$: $\\mathrm{Square}(x)$ and $\\mathrm{Power}(x, 2)$ are the same expression. See [[Sqrt]].",
      "Even function: $(-x)^2 = x^2$, so the sign of the input is lost.",
      "Always non-negative for real x; for a complex number it need not be, e.g. $(1+i)^2 = 2i$.",
      "Threads element-wise over a list.",
      "Square is purely a convenience head: it canonicalizes away to $x^2$ (Power).",
    ],
    examples: [
      { expr: ["Square", 5], expected: 25 },
      { expr: ["Square", -5], expected: 25, caption: "Same result for x and -x" },
      { expr: ["Square", ["Rational", 2, 3]], expected: ["Rational", 4, 9] },
      { expr: ["Square", "x"], expected: ["Power", "x", 2], caption: "Canonicalizes to $x^2$" },
      {
        expr: ["Square", ["List", 2, 3, -4]],
        expected: ["List", 4, 9, 16],
        caption: "Threads element-wise over a list",
      },
      {
        expr: ["Equal", ["Square", -5], ["Square", 5]],
        expected: "True",
        category: "Properties",
        caption: "Even function: $(-x)^2 = x^2$",
      },
      {
        expr: ["Equal", ["Square", ["Complex", 1, 1]], ["Complex", 0, 2]],
        expected: "True",
        category: "Properties",
        caption: "$(1+i)^2 = 2i$ -- squaring a complex number needn't stay real",
      },
      {
        expr: ["Square", 3],
        expected: 9,
        category: "Applications",
        caption: "The area of a 3×3 square tile",
      },
      {
        expr: ["Square", "PositiveInfinity"],
        expected: "PositiveInfinity",
        category: "Possible issues",
        caption: "Infinity squared stays infinite rather than erroring",
      },
    ],
    seeAlso: ["Sqrt", "Root"],
  },
  {
    name: "Sqrt",
    domain: "Arithmetic",
    signature: "Sqrt(x)",
    summary: "The principal square root of x: $\\sqrt{x}$.",
    signatures: [
      { call: "Sqrt(x)", description: "the principal square root $\\sqrt{x} = x^{1/2}$." },
    ],
    details: [
      "The principal square root: $\\sqrt{x} = x^{1/2}$. See [[Root]] for other roots and [[Square]] for the inverse operation.",
      "Evaluates exactly only when the radicand is a perfect square (or a ratio of perfect squares); otherwise it stays in symbolic surd form, like $\\sqrt{2}$.",
      "A negative radicand gives an imaginary result, $\\sqrt{-a} = i\\sqrt{a}$ for $a>0$ -- but only reduces to an exact Complex number when $a$ itself is a perfect square.",
      "$\\sqrt{0} = 0$.",
      "compute-engine's Sqrt is a special case of the more general [[Root]]: $\\mathrm{Root}(x, 2)$ canonicalizes to $\\mathrm{Sqrt}(x)$.",
    ],
    examples: [
      { expr: ["Sqrt", 16], expected: 4 },
      {
        expr: ["Sqrt", 2],
        expected: ["Sqrt", 2],
        caption: "Stays symbolic when the radicand isn't a perfect square",
      },
      { expr: ["Sqrt", ["Rational", 4, 9]], expected: ["Rational", 2, 3] },
      { expr: ["Sqrt", 0], expected: 0 },
      {
        expr: ["Sqrt", -4],
        expected: ["Complex", 0, 2],
        caption: "A perfect square radicand evaluates exactly, even when negative",
      },
      {
        expr: ["Equal", ["Square", ["Sqrt", 16]], 16],
        expected: "True",
        category: "Properties",
        caption: "$(\\sqrt{x})^2 = x$ for a perfect square. See [[Square]]",
      },
      {
        expr: ["Equal", ["Sqrt", 16], ["Power", 16, ["Rational", 1, 2]]],
        expected: "True",
        category: "Properties",
        caption: "$\\sqrt{x} = x^{1/2}$",
      },
      {
        expr: ["Sqrt", ["Add", ["Square", 3], ["Square", 4]]],
        expected: 5,
        category: "Applications",
        caption: "The Pythagorean hypotenuse of a 3-4-5 triangle",
      },
      {
        expr: ["Sqrt", -2],
        expected: ["Sqrt", -2],
        category: "Possible issues",
        caption:
          "Negative but not a perfect square: stays symbolic rather than reducing to an exact complex value",
      },
      {
        expr: ["Sqrt", ["Rational", -4, 9]],
        expected: ["Complex", 0, ["Rational", 2, 3]],
        category: "Possible issues",
        caption:
          "A negative rational still evaluates exactly when both numerator and denominator are perfect squares",
      },
    ],
    seeAlso: ["Root", "Square"],
  },
  {
    name: "Root",
    domain: "Arithmetic",
    signature: "Root(x, n)",
    summary: "The nth root of x: $\\sqrt[n]{x} = x^{1/n}$.",
    signatures: [{ call: "Root(x, n)", description: "the nth root $\\sqrt[n]{x} = x^{1/n}$." }],
    details: [
      "The nth root: $\\mathrm{Root}(x, n) = x^{1/n}$. See [[Sqrt]] for the special case $n = 2$.",
      "Odd roots of a negative number stay real: $\\sqrt[3]{-8} = -2$. Even roots of a negative number canonicalize toward [[Sqrt]] instead, and evaluate exactly only when the radicand is itself a perfect power.",
      "A negative index gives the reciprocal root: $\\mathrm{Root}(x, -n) = x^{-1/n}$.",
      "Both arguments are required -- unlike [[Sqrt]], there's no default index.",
      "Evaluates exactly only when x is a perfect nth power; otherwise it stays in symbolic form, like $\\sqrt[3]{2}$.",
    ],
    examples: [
      { expr: ["Root", 27, 3], expected: 3, caption: "The cube root of 27" },
      { expr: ["Root", 16, 4], expected: 2 },
      {
        expr: ["Root", -8, 3],
        expected: -2,
        caption: "Odd roots of a negative number stay real",
        divergence: {
          wolfram:
            "Wolfram's $(-8)^{1/3}$ is the principal complex root, $1 + \\sqrt{3}\\,i$; its real root is $\\mathrm{Surd}[-8, 3] = -2$.",
        },
      },
      {
        expr: ["Root", 2, 3],
        expected: ["Root", 2, 3],
        caption: "Stays symbolic when x isn't a perfect power",
      },
      {
        expr: ["Root", 16, -2],
        expected: ["Rational", 1, 4],
        caption: "A negative index gives the reciprocal root: $x^{-1/n}$",
      },
      {
        expr: ["Equal", ["Power", ["Root", 8, 3], 3], 8],
        expected: "True",
        category: "Properties",
        caption: "$(\\sqrt[n]{x})^n = x$ for a perfect nth power",
      },
      {
        expr: ["Equal", ["Root", 16, 2], ["Sqrt", 16]],
        expected: "True",
        category: "Properties",
        caption: "Root(x, 2) agrees with [[Sqrt]]",
      },
      {
        expr: ["Root", 1000, 3],
        expected: 10,
        category: "Applications",
        caption: "The edge length of a cube with volume 1000",
      },
      {
        expr: ["Root", -8, 2],
        expected: ["Sqrt", -8],
        category: "Possible issues",
        caption:
          "An even root of a negative, non-perfect-power number canonicalizes to [[Sqrt]] and stays symbolic; numerically it's $2\\sqrt{2}\\,i$",
      },
    ],
    seeAlso: ["Sqrt", "Square"],
  },
  {
    name: "Floor",
    domain: "Arithmetic",
    signature: "Floor(x)",
    summary: "The greatest integer less than or equal to x: $\\lfloor x \\rfloor$.",
    signatures: [
      { call: "Floor(x)", description: "the greatest integer $\\le x$, $\\lfloor x \\rfloor$." },
    ],
    details: [
      "The greatest integer $\\le x$: $\\lfloor x \\rfloor$.",
      "Rounds toward $-\\infty$, not toward 0 -- so $\\lfloor -3.5 \\rfloor = -4$, not $-3$.",
      "For a non-integer x, $\\lceil x \\rceil = \\lfloor x \\rfloor + 1$. See [[Ceil]].",
      "$\\lfloor -x \\rfloor = -\\lceil x \\rceil$.",
      "Threads element-wise over a list.",
      "compute-engine's Floor takes a single argument; only [[Round]] supports rounding to a given number of decimal places.",
    ],
    examples: [
      { expr: ["Floor", ["Rational", 7, 2]], expected: 3 },
      { expr: ["Floor", 3.7], expected: 3 },
      { expr: ["Floor", 5], expected: 5, caption: "Integers pass through unchanged" },
      {
        expr: ["Floor", ["List", 1.2, -1.2, 3.7]],
        expected: ["List", 1, -2, 3],
        caption: "Threads element-wise over a list",
      },
      {
        expr: ["Equal", ["Add", ["Floor", ["Rational", 7, 2]], 1], ["Ceil", ["Rational", 7, 2]]],
        expected: "True",
        category: "Properties",
        caption: "For a non-integer x, $\\lceil x \\rceil = \\lfloor x \\rfloor + 1$. See [[Ceil]]",
      },
      {
        expr: ["Equal", ["Floor", ["Rational", -7, 2]], ["Negate", ["Ceil", ["Rational", 7, 2]]]],
        expected: "True",
        category: "Properties",
        caption: "$\\lfloor -x \\rfloor = -\\lceil x \\rceil$",
      },
      {
        expr: ["Floor", ["Divide", 17, 5]],
        expected: 3,
        category: "Applications",
        caption: "How many full 5-item packs fit in 17 items",
      },
      {
        expr: ["Floor", -3.2],
        expected: -4,
        category: "Possible issues",
        caption: "Rounds toward $-\\infty$, not toward 0: floor(-3.2) is -4, not -3",
      },
      {
        expr: ["Floor", "NegativeInfinity"],
        expected: "NegativeInfinity",
        category: "Possible issues",
        caption: "Infinities pass through unchanged",
      },
    ],
    seeAlso: ["Ceil", "Round"],
  },
  {
    name: "Ceil",
    domain: "Arithmetic",
    signature: "Ceil(x)",
    summary: "The least integer greater than or equal to x: $\\lceil x \\rceil$.",
    signatures: [
      { call: "Ceil(x)", description: "the least integer $\\ge x$, $\\lceil x \\rceil$." },
    ],
    details: [
      "The least integer $\\ge x$: $\\lceil x \\rceil$.",
      "Rounds toward $+\\infty$, not toward 0 -- so $\\lceil -3.7 \\rceil = -3$, not $-4$.",
      "For a non-integer x, $\\lceil x \\rceil = \\lfloor x \\rfloor + 1$. See [[Floor]].",
      "Agrees with [[Floor]] exactly on integers.",
      "Threads element-wise over a list.",
      "compute-engine's Ceil takes a single argument; only [[Round]] supports rounding to a given number of decimal places.",
    ],
    examples: [
      { expr: ["Ceil", ["Rational", 7, 2]], expected: 4 },
      { expr: ["Ceil", 3.2], expected: 4 },
      { expr: ["Ceil", 5], expected: 5, caption: "Integers pass through unchanged" },
      {
        expr: ["Ceil", ["List", 1.2, -1.2, 3.7]],
        expected: ["List", 2, -1, 4],
        caption: "Threads element-wise over a list",
      },
      {
        expr: ["Equal", ["Ceil", ["Rational", 7, 2]], ["Add", ["Floor", ["Rational", 7, 2]], 1]],
        expected: "True",
        category: "Properties",
        caption: "$\\lceil x \\rceil = \\lfloor x \\rfloor + 1$ for non-integer x. See [[Floor]]",
      },
      {
        expr: ["Equal", ["Ceil", 5], ["Floor", 5]],
        expected: "True",
        category: "Properties",
        caption: "Floor and Ceil agree exactly on integers",
      },
      {
        expr: ["Ceil", ["Divide", 17, 5]],
        expected: 4,
        category: "Applications",
        caption: "How many 5-seat vans are needed to carry 17 people",
      },
      {
        expr: ["Ceil", -3.7],
        expected: -3,
        category: "Possible issues",
        caption: "Rounds toward $+\\infty$, not toward 0: ceil(-3.7) is -3, not -4",
      },
      {
        expr: ["Ceil", "NaN"],
        expected: "NaN",
        category: "Possible issues",
        caption: "NaN propagates rather than erroring",
      },
    ],
    seeAlso: ["Floor", "Round"],
  },
  {
    name: "Round",
    domain: "Arithmetic",
    signature: "Round(x, n?)",
    summary: "Rounds x to the nearest integer, or to n decimal places.",
    signatures: [
      { call: "Round(x)", description: "rounds x to the nearest integer, ties away from 0." },
      {
        call: "Round(x, n)",
        description:
          "rounds to the nearest $10^{-n}$: n decimal places, or -- for negative n -- the nearest power of ten.",
      },
    ],
    details: [
      "Rounds to the nearest integer, with ties (an exact .5) breaking away from 0: $\\mathrm{Round}(2.5) = 3$ and $\\mathrm{Round}(-2.5) = -3$.",
      "A second, integer argument n rounds to the nearest $10^{-n}$ instead: positive n gives n decimal places, negative n rounds to the nearest power of ten.",
      "$\\mathrm{Round}(x, 0)$ agrees with the 1-argument form.",
      "Threads element-wise over a list.",
      "The digits argument must be an integer; unlike [[Floor]] and [[Ceil]], which take no second argument at all, Round is the only one of the three with quantized rounding.",
    ],
    examples: [
      { expr: ["Round", ["Rational", 7, 2]], expected: 4 },
      { expr: ["Round", 3.5], expected: 4 },
      { expr: ["Round", 5], expected: 5, caption: "Integers pass through unchanged" },
      {
        expr: ["Round", 3.14159, 2],
        expected: ["Rational", 157, 50],
        caption: "A second argument rounds to that many decimal places",
      },
      {
        expr: ["Round", ["List", 1.5, -1.5, 2.4]],
        expected: ["List", 2, -2, 2],
        caption: "Threads element-wise over a list",
      },
      {
        expr: ["Equal", ["Round", 1234, -2], 1200],
        expected: "True",
        category: "Properties",
        caption:
          "A negative second argument rounds to the nearest power of ten instead -- here, the nearest hundred",
        divergence: {
          wolfram:
            "Wolfram reads the second argument as a step to round to a multiple of, so $\\mathrm{Round}[1234, -2] = 1234$.",
        },
      },
      {
        expr: ["Equal", ["Round", 3.14159, 0], ["Round", 3.14159]],
        expected: "True",
        category: "Properties",
        caption: "Rounding to 0 decimal places matches the 1-argument form",
        divergence: {
          wolfram:
            "Wolfram treats the step literally, so $\\mathrm{Round}[3.14159, 0]$ is $\\mathrm{Indeterminate}$.",
        },
      },
      {
        expr: ["Round", 19.995, 2],
        expected: 20,
        category: "Applications",
        caption: "Rounding a price to the nearest cent: 19.995 rounds up to 20",
      },
      {
        expr: ["Round", 2.5],
        expected: 3,
        category: "Possible issues",
        caption: "Rounds half away from zero, not banker's rounding: 2.5 rounds to 3, not 2",
        divergence: {
          wolfram:
            "Wolfram uses round-half-to-even (banker's rounding), so $\\mathrm{Round}[2.5] = 2$.",
        },
      },
      {
        expr: ["Round", -2.5],
        expected: -3,
        category: "Possible issues",
        caption: "...and by the same convention, -2.5 rounds to -3, not -2",
        divergence: {
          wolfram: "Wolfram's half-to-even gives $\\mathrm{Round}[-2.5] = -2$.",
        },
      },
    ],
    seeAlso: ["Floor", "Ceil", "Clamp"],
  },
  {
    name: "Clamp",
    domain: "Arithmetic",
    signature: "Clamp(x, lower, upper)",
    summary: "Constrains x to the range [lower, upper].",
    signatures: [
      {
        call: "Clamp(x, lower, upper)",
        description:
          "x if it's already in $[\\mathrm{lower}, \\mathrm{upper}]$, else the nearer bound.",
      },
      {
        call: "Clamp(x)",
        description: "x clamped to the default range $[-1, 1]$, Wolfram's Clip[x].",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Constrains a value to $[\\mathrm{lower}, \\mathrm{upper}]$: below lower it returns lower, above upper it returns upper, otherwise x unchanged.",
      "A 1-argument $\\mathrm{Clamp}(x)$ defaults to $[-1, 1]$, matching Wolfram's Clip[x].",
      "Idempotent: clamping an already-clamped value changes nothing.",
      "Doesn't validate that lower $\\le$ upper; with the bounds swapped it just falls through whichever comparison fires first.",
    ],
    examples: [
      { expr: ["Clamp", 5, 0, 3], expected: 3 },
      { expr: ["Clamp", -1, 0, 3], expected: 0 },
      {
        expr: ["Clamp", 2, 0, 3],
        expected: 2,
        caption: "Values already inside the range pass through unchanged",
      },
      {
        expr: ["Equal", ["Clamp", ["Clamp", 5, 0, 3], 0, 3], ["Clamp", 5, 0, 3]],
        expected: "True",
        category: "Properties",
        caption: "Idempotent: clamping an already-clamped value changes nothing",
      },
      {
        expr: ["Clamp", 112, 0, 100],
        expected: 100,
        category: "Applications",
        caption: "Capping a percentage-like value at 100",
      },
      {
        expr: ["Clamp", 5, 3, 0],
        expected: 0,
        category: "Possible issues",
        caption:
          "No validation that lower ≤ upper -- with the bounds swapped, this just falls through the upper-bound check",
      },
      {
        expr: ["Clamp", "x", 0, 3],
        expected: ["Clamp", "x", 0, 3],
        category: "Possible issues",
        caption: "A symbolic value is left unevaluated rather than assumed to already lie in range",
      },
      {
        expr: ["Clamp", 1.5],
        expected: 1,
        category: "Scope",
        caption: "A 1-argument $\\mathrm{Clamp}(x)$ clamps to the default range $[-1, 1]$",
      },
    ],
    seeAlso: ["Min", "Max"],
  },
  {
    name: "Chop",
    domain: "Arithmetic",
    signature: "Chop(x)",
    summary: "Replaces a real number very close to 0 with exact 0.",
    signatures: [
      {
        call: "Chop(x)",
        description: "0 if $|x|$ is smaller than about $10^{-10}$, else x unchanged.",
      },
    ],
    details: [
      "Replaces a value smaller in magnitude than about $10^{-10}$ with exact 0 -- cleanup for the floating-point noise left over from a numeric computation.",
      "Chops the real and imaginary parts of a complex number independently.",
      "Only the value's own magnitude matters -- $\\mathrm{Chop}(1.000000000001)$ stays as is, since it isn't close to 0, even though it's close to the integer 1.",
      "Takes a single argument; there's no way to override the $10^{-10}$ threshold.",
    ],
    examples: [
      {
        expr: ["Chop", 1.2],
        expected: 1.2,
        caption: "Values not near zero pass through unchanged",
      },
      {
        expr: ["Chop", 1e-11],
        expected: 0,
        caption: "Values smaller than about $10^{-10}$ collapse to exactly 0",
      },
      { expr: ["Chop", -1e-11], expected: 0, caption: "Negative values chop the same way" },
      {
        expr: ["Chop", ["Complex", 1e-12, 3]],
        expected: ["Complex", 0, 3],
        caption: "Chops the real and imaginary parts independently",
      },
      {
        expr: ["Chop", ["Subtract", ["Multiply", 3, ["N", ["Divide", 1, 3]]], 1]],
        expected: 0,
        category: "Applications",
        caption:
          "Cleans up the floating-point residue from computing $3\\times(1/3)-1$ numerically",
      },
      {
        expr: ["Chop", ["Add", 1, 1e-12]],
        expected: 1.000000000001,
        category: "Possible issues",
        caption:
          "Only the value's own magnitude matters -- this stays as is since it isn't close to 0, even though it's close to the integer 1",
      },
      {
        expr: ["Chop", 1.0000000001e-10],
        expected: 1.0000000001e-10,
        category: "Possible issues",
        caption:
          "A hard cutoff at about $10^{-10}$: a value just above the threshold survives untouched",
      },
    ],
    seeAlso: ["Round"],
  },
  {
    name: "Rationalize",
    domain: "Arithmetic",
    signature: "Rationalize(x, tolerance?)",
    summary: "Finds a simple rational number near x.",
    signatures: [
      {
        call: "Rationalize(x)",
        description: "the simplest rational within about one machine epsilon of x.",
      },
      {
        call: "Rationalize(x, tolerance)",
        description: "the simplest rational within the given tolerance of x.",
      },
    ],
    details: [
      "Finds a simple rational number near x.",
      "With one argument, it finds the simplest fraction within about one machine epsilon of x's current value; a second argument sets an explicit tolerance instead.",
      "An already-exact rational (or integer) is returned unchanged.",
      "Builds the approximation via continued fractions, the same technique behind classic approximations like $\\pi \\approx 355/113$.",
    ],
    examples: [
      { expr: ["Rationalize", 0.1], expected: ["Rational", 1, 10] },
      { expr: ["Rationalize", 2], expected: 2, caption: "An exact integer is returned unchanged" },
      { expr: ["Rationalize", 2.5], expected: ["Rational", 5, 2] },
      {
        expr: ["Rationalize", 0.3333333333333333],
        expected: ["Rational", 1, 3],
        caption: "Recognizes a float that is, to machine precision, a simple fraction",
      },
      {
        expr: ["Equal", ["Rationalize", "Pi", 0.01], ["Rational", 22, 7]],
        expected: "True",
        category: "Properties",
        caption:
          "With an explicit tolerance, recovers a classic approximation: 22/7 is within 0.01 of π",
      },
      {
        expr: ["Rationalize", "Pi", 0.000001],
        expected: ["Rational", 355, 113],
        category: "Neat examples",
        caption:
          "Milü, Zu Chongzhi's 5th-century approximation of π, accurate to six decimal places",
      },
      {
        expr: ["Rationalize", 0.75],
        expected: ["Rational", 3, 4],
        category: "Applications",
        caption: "Recovers a simple fraction from a decimal measurement",
      },
      {
        expr: ["Rationalize", 0.333333],
        expected: ["Rational", 333333, 1000000],
        category: "Possible issues",
        caption:
          "Without enough repeating digits to reach machine precision, it just returns the exact decimal as a fraction rather than snapping to 1/3",
      },
      {
        expr: ["Rationalize", 0.1, 0.5],
        expected: 0,
        category: "Possible issues",
        caption: "A loose tolerance can snap to something far simpler -- 0 is within 0.5 of 0.1",
      },
    ],
    seeAlso: ["Round"],
  },
  {
    name: "Max",
    domain: "Arithmetic",
    signature: "Max(a, b, …)",
    summary: "The largest of its arguments.",
    signatures: [
      { call: "Max(a, b, …)", description: "the largest of two or more values." },
      { call: "Max(list)", description: "the largest value in a list." },
    ],
    details: [
      "The largest of its arguments, or of a single list argument.",
      "Multiple arguments -- lists included -- are flattened into one pool rather than compared pairwise or threaded element-wise. See [[Min]].",
      "Commutative and associative: order and grouping don't matter.",
      "NaN poisons the result: it beats every other comparison, even $+\\infty$.",
      "With no arguments, compute-engine returns NaN rather than $-\\infty$, the true identity element.",
    ],
    examples: [
      { expr: ["Max", 3, 1, 4, 1, 5], expected: 5 },
      {
        expr: ["Max", ["List", 3, 1, 4]],
        expected: 4,
        caption: "Also accepts a single list argument",
      },
      { expr: ["Max", -1, -5], expected: -1 },
      { expr: ["Max", 3], expected: 3, caption: "A single argument is returned unchanged" },
      {
        expr: ["Equal", ["Max", 3, 7], ["Max", 7, 3]],
        expected: "True",
        category: "Properties",
        caption: "Commutative: order doesn't matter",
      },
      {
        expr: ["Equal", ["Max", ["List", 3, 1, 4], ["List", 9, 2]], 9],
        expected: "True",
        category: "Properties",
        caption:
          "Multiple list arguments are flattened into one pool rather than compared pairwise",
      },
      {
        expr: ["Max", 68, 72, 65, 80, 74],
        expected: 80,
        category: "Applications",
        caption: "The day's high from a handful of hourly readings. See [[Min]]",
      },
      {
        expr: ["Max"],
        expected: "NaN",
        category: "Possible issues",
        caption:
          "With no arguments, compute-engine returns NaN rather than $-\\infty$, the true identity element",
        divergence: {
          wolfram: "Max of nothing is NaN here; Wolfram returns the identity element -Infinity.",
        },
      },
      {
        expr: ["Max", "NaN", 3],
        expected: "NaN",
        category: "Possible issues",
        caption: "NaN poisons the result, overriding every other argument",
      },
    ],
    seeAlso: ["Min", "Clamp"],
  },
  {
    name: "Min",
    domain: "Arithmetic",
    signature: "Min(a, b, …)",
    summary: "The smallest of its arguments.",
    signatures: [
      { call: "Min(a, b, …)", description: "the smallest of two or more values." },
      { call: "Min(list)", description: "the smallest value in a list." },
    ],
    details: [
      "The smallest of its arguments, or of a single list argument.",
      "Multiple arguments -- lists included -- are flattened into one pool rather than compared pairwise or threaded element-wise. See [[Max]].",
      "Commutative and associative: order and grouping don't matter.",
      "$\\min(a,b) + \\max(a,b) = a + b$ for any two values. See [[Max]].",
      "Infinities participate directly in the comparison.",
    ],
    examples: [
      { expr: ["Min", 3, 1, 4, 1, 5], expected: 1 },
      {
        expr: ["Min", ["List", 3, 1, 4]],
        expected: 1,
        caption: "Also accepts a single list argument",
      },
      { expr: ["Min", -1, -5], expected: -5 },
      { expr: ["Min", 3], expected: 3, caption: "A single argument is returned unchanged" },
      {
        expr: ["Equal", ["Min", 3, 7], ["Min", 7, 3]],
        expected: "True",
        category: "Properties",
        caption: "Commutative: order doesn't matter",
      },
      {
        expr: ["Equal", ["Add", ["Min", 4, 9], ["Max", 4, 9]], ["Add", 4, 9]],
        expected: "True",
        category: "Properties",
        caption: "$\\min(a,b) + \\max(a,b) = a + b$. See [[Max]]",
      },
      {
        expr: ["Min", 68, 72, 65, 80, 74],
        expected: 65,
        category: "Applications",
        caption: "The day's low from the same hourly readings. See [[Max]]",
      },
      {
        expr: ["Min", "NegativeInfinity", 3],
        expected: "NegativeInfinity",
        category: "Possible issues",
        caption: "Infinities participate directly in the comparison rather than being filtered out",
      },
      {
        expr: ["Min", ["List", 3, 1], 0],
        expected: 0,
        category: "Possible issues",
        caption:
          "Multiple arguments -- lists included -- are flattened into one pool rather than compared list-by-list. See [[Max]]",
      },
    ],
    seeAlso: ["Max", "Clamp"],
  },
  {
    name: "IsOdd",
    domain: "Arithmetic",
    signature: "IsOdd(n)",
    summary: "Whether n is an odd integer.",
    signatures: [
      { call: "IsOdd(n)", description: "$True$ if $n$ is an odd integer, else $False$." },
    ],
    examples: [
      { expr: ["IsOdd", 3], expected: "True" },
      { expr: ["IsOdd", 4], expected: "False" },
      { expr: ["IsOdd", -7], expected: "True", caption: "Negative integers count too" },
    ],
    seeAlso: ["IsEven"],
  },
  {
    name: "IsEven",
    domain: "Arithmetic",
    signature: "IsEven(n)",
    summary: "Whether n is an even integer.",
    signatures: [
      { call: "IsEven(n)", description: "$True$ if $n$ is an even integer, else $False$." },
    ],
    examples: [
      { expr: ["IsEven", 4], expected: "True" },
      { expr: ["IsEven", 3], expected: "False" },
      { expr: ["IsEven", 0], expected: "True", caption: "Zero is even" },
    ],
    seeAlso: ["IsOdd"],
  },
];
