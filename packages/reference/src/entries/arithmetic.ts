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
      { expr: ["Abs", -2.5], expected: 2.5 },
      {
        expr: ["Abs", ["Complex", 1.4, 2.3]],
        expected: { num: "2.69258240356725201563" },
        caption: "The modulus of a complex number with approximate parts",
      },
      {
        expr: [
          "Abs",
          [
            "List",
            ["List", ["Rational", 1, 2], -1],
            ["List", ["Rational", -5, 3], ["Rational", 1, 2]],
          ],
        ],
        expected: [
          "List",
          ["List", ["Rational", 1, 2], 1],
          ["List", ["Rational", 5, 3], ["Rational", 1, 2]],
        ],
        category: "Scope",
        caption: "Threads over a matrix, entry by entry",
      },
      {
        expr: ["Abs", ["Negate", "Pi"]],
        expected: "Pi",
        category: "Scope",
        caption: "Exact numeric constants",
      },
      {
        expr: ["Abs", ["Complex", 1, 1]],
        expected: ["Sqrt", 2],
        category: "Scope",
        caption: "An exact complex number gives an exact radical",
      },
      { expr: ["Abs", "ImaginaryUnit"], expected: 1, category: "Scope" },
      {
        expr: ["Abs", ["Exp", ["Multiply", "ImaginaryUnit", ["Divide", "Pi", 3]]]],
        expected: 1,
        category: "Scope",
        caption: "$e^{i\\pi/3}$ lies on the unit circle",
      },
      { expr: ["Abs", "NegativeInfinity"], expected: "PositiveInfinity", category: "Scope" },
      {
        expr: ["Abs", "ComplexInfinity"],
        expected: "PositiveInfinity",
        category: "Scope",
        caption: "Complex infinity has infinite magnitude in every direction",
      },
      {
        expr: ["Abs", ["Interval", -3, 5]],
        expected: ["Interval", 0, 5],
        category: "Scope",
        caption: "An [[Interval]] maps to the interval of absolute values, $[0, 5]$",
      },
      {
        expr: ["Abs", ["Subtract", ["Sqrt", 2], 2]],
        expected: ["Add", 2, ["Negate", ["Sqrt", 2]]],
        aspirational: true,
        category: "Scope",
        caption:
          "Should decide the sign of an exact numeric expression and give $2-\\sqrt{2}$; not yet, it stays unevaluated",
      },
      {
        expr: [
          "Equal",
          ["Power", ["Abs", ["Complex", 3, 4]], 2],
          ["Multiply", ["Complex", 3, 4], ["Conjugate", ["Complex", 3, 4]]],
        ],
        expected: "True",
        category: "Properties",
        caption: "$|z|^2 = z\\bar{z}$",
      },
      {
        expr: [
          "Equal",
          ["Abs", ["Multiply", ["Complex", 1, 2], ["Complex", 3, -1]]],
          ["Multiply", ["Abs", ["Complex", 1, 2]], ["Abs", ["Complex", 3, -1]]],
        ],
        expected: "True",
        category: "Properties",
        caption: "Multiplicative: $|ab| = |a|\\,|b|$",
      },
      {
        expr: ["Abs", ["Subtract", ["Complex", 1, 1], ["Complex", 4, 5]]],
        expected: 5,
        category: "Applications",
        caption: "The distance between the points $1+i$ and $4+5i$ of the complex plane",
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
      { expr: ["Sign", -2.5], expected: -1 },
      { expr: ["Sign", 3.14], expected: 1 },
      {
        expr: ["Sign", ["Complex", 1.4, 2.3]],
        expected: ["Complex", { num: "0.5199469468957452168102" }, 0.8541985556144385],
        caption: "A complex number with approximate parts",
      },
      {
        expr: ["Sign", ["Complex", 1, 1]],
        expected: ["Complex", { num: "0.7071067811865475244008444" }, 0.7071067811865476],
        category: "Scope",
        caption: "An exact complex argument comes back numeric",
        divergence: { wolfram: "Wolfram keeps it exact: $\\mathrm{Sign}[1+i] = (1+i)/\\sqrt{2}$." },
      },
      {
        expr: [
          "Sign",
          [
            "List",
            ["List", ["Rational", 1, 2], -1],
            ["List", ["Rational", -5, 3], ["Rational", 1, 2]],
          ],
        ],
        expected: ["List", ["List", 1, -1], ["List", -1, 1]],
        category: "Scope",
        caption: "Threads over a matrix, entry by entry",
      },
      { expr: ["Sign", "Pi"], expected: 1, category: "Scope", caption: "Exact numeric constants" },
      { expr: ["Sign", ["Negate", "ExponentialE"]], expected: -1, category: "Scope" },
      { expr: ["Sign", "ImaginaryUnit"], expected: ["Complex", 0, 1], category: "Scope" },
      { expr: ["Sign", "PositiveInfinity"], expected: 1, category: "Scope" },
      {
        expr: ["Sign", ["Interval", 1, 3]],
        expected: 1,
        aspirational: true,
        category: "Scope",
        caption:
          "An [[Interval]] of positive numbers should have sign 1; compute-engine leaves it unevaluated",
      },
      {
        expr: ["Sign", ["Subtract", ["Sqrt", 2], 2]],
        expected: -1,
        aspirational: true,
        category: "Scope",
        caption:
          "Should decide the sign of the exact number $\\sqrt{2}-2$; not yet, it stays unevaluated",
      },
      {
        expr: ["Equal", ["Abs", ["Sign", ["Complex", 3, 4]]], 1],
        expected: "True",
        category: "Properties",
        caption: "The sign of a nonzero complex number lies on the unit circle",
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
      { expr: ["Negate", "x"], expected: ["Negate", "x"], caption: "Stays symbolic" },
      { expr: ["Negate", ["Complex", 1, 2]], expected: ["Complex", -1, -2], category: "Scope" },
      {
        expr: ["Negate", ["List", ["List", 1, -2], ["List", 3, 4]]],
        expected: ["List", ["List", -1, 2], ["List", -3, -4]],
        category: "Scope",
        caption: "Threads over a matrix, entry by entry",
      },
      {
        expr: ["Negate", ["Multiply", 2, "x"]],
        expected: ["Multiply", -2, "x"],
        category: "Scope",
        caption: "Folds into a numeric coefficient",
      },
      {
        expr: ["Negate", ["Subtract", "a", "b"]],
        expected: ["Add", ["Negate", "a"], "b"],
        category: "Properties",
        caption: "$-(a-b) = b-a$",
      },
      {
        expr: ["Add", ["Negate", "x"], "x"],
        expected: 0,
        category: "Properties",
        caption: "The additive inverse: $x + (-x) = 0$",
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
      {
        expr: ["Sqrt", 3.5],
        expected: { num: "1.87082869338697069279" },
        caption: "An approximate number gives an approximate root",
      },
      {
        expr: ["Sqrt", 200],
        expected: ["Multiply", 10, ["Sqrt", 2]],
        caption: "Pulls perfect-square factors out of the radical",
      },
      { expr: ["Sqrt", -25], expected: ["Complex", 0, 5] },
      { expr: ["Sqrt", 8], expected: ["Multiply", 2, ["Sqrt", 2]], category: "Scope" },
      {
        expr: ["Sqrt", ["Rational", 1, 2]],
        expected: ["Divide", ["Sqrt", 2], 2],
        category: "Scope",
        caption: "Rationalizes the denominator",
      },
      {
        expr: ["Sqrt", ["Rational", 12, 5]],
        expected: ["Multiply", ["Rational", 2, 5], ["Sqrt", 15]],
        category: "Scope",
      },
      { expr: ["Sqrt", -2.5], expected: ["Complex", 0, 1.5811388300841898], category: "Scope" },
      {
        expr: ["Sqrt", ["Complex", 3, 4]],
        expected: ["Complex", 2, 1],
        category: "Scope",
        caption: "An exact complex square: $(2+i)^2 = 3+4i$",
      },
      { expr: ["Sqrt", "PositiveInfinity"], expected: "PositiveInfinity", category: "Scope" },
      {
        expr: ["Sqrt", ["List", 1, 4, 9]],
        expected: ["List", 1, 2, 3],
        category: "Scope",
        caption: "Threads element-wise over a list",
      },
      {
        expr: ["Sqrt", ["List", ["List", ["Rational", 1, 2], -1], ["List", 0, ["Rational", 1, 2]]]],
        expected: [
          "List",
          ["List", ["Divide", ["Sqrt", 2], 2], ["Complex", 0, 1]],
          ["List", 0, ["Divide", ["Sqrt", 2], 2]],
        ],
        category: "Scope",
        caption: "Threads over a matrix entry by entry -- this is not the matrix square root",
      },
      {
        expr: ["Sqrt", ["Interval", 1, 8]],
        expected: ["Interval", 1, ["Multiply", 2, ["Sqrt", 2]]],
        aspirational: true,
        category: "Scope",
        caption:
          "An [[Interval]] should map to $[1, 2\\sqrt{2}]$; compute-engine's Sqrt rejects a set argument",
      },
      {
        expr: ["Power", ["Sqrt", "x"], 2],
        expected: "x",
        category: "Properties",
        caption: "$(\\sqrt{x})^2 = x$ for every x",
      },
      {
        expr: ["Sqrt", ["Power", "x", 2]],
        expected: ["Sqrt", ["Power", "x", 2]],
        category: "Possible issues",
        caption: "$\\sqrt{x^2}$ is not simplified to x, which would be wrong for negative x",
      },
      {
        expr: ["Sqrt", ["Power", -1, 2]],
        expected: 1,
        category: "Possible issues",
        caption: "...at $x = -1$, $\\sqrt{x^2} = 1$, not $-1$",
      },
      {
        expr: ["Multiply", ["Sqrt", -1], ["Sqrt", -1]],
        expected: -1,
        category: "Possible issues",
        caption:
          "$\\sqrt{a}\\sqrt{b} = \\sqrt{ab}$ fails for negative a and b: $\\sqrt{-1}\\sqrt{-1} = -1$...",
      },
      {
        expr: ["Sqrt", ["Multiply", -1, -1]],
        expected: 1,
        category: "Possible issues",
        caption: "...while $\\sqrt{(-1)(-1)} = 1$",
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
      {
        expr: ["Root", -27, 3],
        expected: -3,
        category: "Scope",
        caption: "The real cube root, Wolfram's $\\mathrm{Surd}[-27, 3]$",
      },
      {
        expr: ["Root", -32, 5],
        expected: -2,
        category: "Scope",
        caption: "Any odd root of a negative number is real",
      },
      {
        expr: ["Root", -3.5, 5],
        expected: { num: "-1.28473515712343933868" },
        category: "Scope",
        caption: "Approximate negative radicands stay real too",
      },
      {
        expr: ["Root", ["List", -8, 27], 3],
        expected: ["List", -2, 3],
        category: "Scope",
        caption: "Threads element-wise over a list",
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
      { expr: ["Floor", 2.4], expected: 2 },
      { expr: ["Floor", 2.6], expected: 2 },
      {
        expr: ["Floor", "x"],
        expected: ["Floor", "x"],
        category: "Scope",
        caption: "Stays symbolic",
      },
      {
        expr: ["Floor", ["Sqrt", 50]],
        expected: 7,
        category: "Scope",
        caption: "Exact radicals are decided numerically",
      },
      {
        expr: ["Floor", "Pi"],
        expected: 3,
        category: "Scope",
        caption: "Evaluates at an exact constant: $\\lfloor\\pi\\rfloor = 3$",
      },
      {
        expr: ["Floor", ["Negate", "Pi"]],
        expected: -4,
        category: "Scope",
        caption: "...and at its negative, $\\lfloor -\\pi \\rfloor = -4$",
      },
      {
        expr: ["Floor", 226, 10],
        expected: 220,
        aspirational: true,
        category: "Scope",
        caption:
          "A second argument should floor to a multiple of it -- the nearest multiple of 10 below 226; Floor takes one argument",
      },
      {
        expr: ["Floor", -10.3, 3.5],
        expected: -10.5,
        aspirational: true,
        category: "Scope",
        caption:
          "...the step needn't be an integer: $3.5 \\cdot \\lfloor -10.3/3.5 \\rfloor = -10.5$; not yet",
      },
      {
        expr: ["Floor", ["Subtract", ["Multiply", 2, "Pi"], "ExponentialE"], ["Rational", 5, 4]],
        expected: ["Rational", 5, 2],
        aspirational: true,
        category: "Scope",
        caption:
          "...nor rational: $2\\pi - e \\approx 3.57$ floors to the multiple $5/2$ of $5/4$; not yet",
      },
      {
        expr: ["Floor", ["Complex", 5.37, -1.3]],
        expected: ["Complex", 5, -2],
        aspirational: true,
        category: "Scope",
        caption:
          "Should floor the real and imaginary parts separately; compute-engine's Floor is real-only",
      },
      {
        expr: ["Floor", ["Floor", "x"]],
        expected: ["Floor", "x"],
        category: "Properties",
        caption:
          "Idempotent: $\\lfloor\\lfloor x \\rfloor\\rfloor = \\lfloor x \\rfloor$, since the inner value is already an integer",
      },
      {
        expr: ["Add", ["Floor", ["Divide", 100, 5]], ["Floor", ["Divide", 100, 25]]],
        expected: 24,
        category: "Applications",
        caption:
          "Legendre's formula: $100!$ ends in $\\lfloor 100/5 \\rfloor + \\lfloor 100/25 \\rfloor = 24$ zeros",
      },
      {
        expr: ["Add", ["Floor", ["Log", 12345]], 1],
        expected: 5,
        category: "Applications",
        caption: "The number of decimal digits of n is $\\lfloor \\log_{10} n \\rfloor + 1$",
      },
      {
        expr: ["Floor", ["Multiply", 1000, "ExponentialE"]],
        expected: 2718,
        category: "Applications",
        caption: "The first four digits of $e$",
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
      { expr: ["Ceil", 2.4], expected: 3 },
      { expr: ["Ceil", 2.6], expected: 3 },
      {
        expr: ["Ceil", "x"],
        expected: ["Ceil", "x"],
        category: "Scope",
        caption: "Stays symbolic",
      },
      {
        expr: ["Ceil", ["Sqrt", 50]],
        expected: 8,
        category: "Scope",
        caption: "Exact radicals are decided numerically",
      },
      {
        expr: ["Ceil", "Pi"],
        expected: 4,
        category: "Scope",
        caption: "Evaluates at an exact constant: $\\lceil\\pi\\rceil = 4$",
      },
      {
        expr: ["Ceil", 226, 10],
        expected: 230,
        aspirational: true,
        category: "Scope",
        caption:
          "A second argument should round up to a multiple of it -- the next multiple of 10 above 226; Ceil takes one argument",
      },
      {
        expr: ["Ceil", -10.3, 3.5],
        expected: -7,
        aspirational: true,
        category: "Scope",
        caption:
          "...the step needn't be an integer: $3.5 \\cdot \\lceil -10.3/3.5 \\rceil = -7$; not yet",
      },
      {
        expr: ["Ceil", ["Subtract", ["Multiply", 2, "Pi"], "ExponentialE"], ["Rational", 5, 4]],
        expected: ["Rational", 15, 4],
        aspirational: true,
        category: "Scope",
        caption:
          "...nor rational: $2\\pi - e \\approx 3.57$ rounds up to the multiple $15/4$ of $5/4$; not yet",
      },
      {
        expr: ["Ceil", ["Complex", 5.37, -1.3]],
        expected: ["Complex", 6, -1],
        aspirational: true,
        category: "Scope",
        caption:
          "Should round the real and imaginary parts up separately; compute-engine's Ceil is real-only",
      },
      {
        expr: ["Ceil", ["Log", 1000, 2]],
        expected: 10,
        category: "Applications",
        caption: "Ten bits are enough to number 1000 items, $\\lceil \\log_2 1000 \\rceil$",
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
      { expr: ["Round", 2.4], expected: 2 },
      { expr: ["Round", 2.6], expected: 3 },
      { expr: ["Round", 5.37], expected: 5 },
      { expr: ["Round", -3.7], expected: -4 },
      {
        expr: ["Round", "x"],
        expected: ["Round", "x"],
        category: "Scope",
        caption: "Stays symbolic",
      },
      {
        expr: ["Round", 226, -1],
        expected: 230,
        category: "Scope",
        caption: "To the nearest ten",
        divergence: {
          wolfram:
            "Wolfram's second argument is the step itself: $\\mathrm{Round}[226, 10] = 230$.",
        },
      },
      {
        expr: ["Round", ["Sqrt", 2], 4],
        expected: ["Rational", 7071, 5000],
        category: "Scope",
        caption: "An exact argument rounds to an exact rational",
      },
      {
        expr: ["Round", "Pi"],
        expected: 3,
        category: "Scope",
        caption: "Evaluates at an exact constant: $\\mathrm{Round}(\\pi) = 3$",
      },
      {
        expr: ["Round", ["Multiply", 100, "ExponentialE"]],
        expected: 272,
        category: "Scope",
        caption: "$100e \\approx 271.83$ rounds to 272",
      },
      {
        expr: ["Round", ["Complex", 5.37, -1.3]],
        expected: ["Complex", 5, -1],
        aspirational: true,
        category: "Scope",
        caption:
          "Should round the real and imaginary parts separately; compute-engine's Round is real-only",
      },
      {
        expr: ["Round", ["Rational", 1, 2]],
        expected: 1,
        category: "Possible issues",
        caption: "An exact half rounds away from zero as well",
        divergence: { wolfram: "Wolfram rounds half to even: $\\mathrm{Round}[1/2] = 0$." },
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
      {
        expr: ["Clamp", ["List", -2, 0.5, 3], 0, 1],
        expected: ["List", 0, 0.5, 1],
        category: "Scope",
        caption: "Threads element-wise over a list",
      },
      {
        expr: ["Clamp", "Pi", 0, 3],
        expected: 3,
        category: "Scope",
        caption: "Exact numeric constants are compared numerically",
      },
      { expr: ["Clamp", ["Rational", 7, 2], 1, 3], expected: 3, category: "Scope" },
      {
        expr: ["Clamp", "PositiveInfinity", 0, 3],
        expected: 3,
        category: "Scope",
        caption: "Infinities clamp to the nearer bound",
      },
      {
        expr: ["Clamp", 5, 0, 3, -1, 10],
        expected: 10,
        aspirational: true,
        category: "Scope",
        caption:
          "Wolfram's $\\mathrm{Clip}[x, \\{min, max\\}, \\{v_{min}, v_{max}\\}]$ returns replacement values outside the range -- here 10 above it; not yet supported",
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
      {
        expr: ["Chop", ["List", 1.2, 1e-11, 3.5]],
        expected: ["List", 1.2, 0, 3.5],
        category: "Scope",
        caption: "Threads element-wise over a list",
      },
      {
        expr: ["Chop", ["Add", 1, ["Complex", 0, 1e-14]]],
        expected: 1,
        category: "Scope",
        caption: "A negligible imaginary part is dropped, leaving a real number",
      },
      {
        expr: ["Chop", "x"],
        expected: ["Chop", "x"],
        category: "Scope",
        caption: "Stays symbolic",
      },
      {
        expr: ["Chop", ["Rational", 1, 3]],
        expected: ["Rational", 1, 3],
        category: "Scope",
        caption: "Exact numbers not near zero pass through",
      },
      {
        expr: ["Chop", 0.001, 0.01],
        expected: 0,
        aspirational: true,
        category: "Scope",
        caption:
          "A second argument should set the tolerance, here chopping anything below 0.01; Chop takes one argument",
      },
      {
        expr: ["Chop", 1e-15, 1e-20],
        expected: 1e-15,
        aspirational: true,
        category: "Scope",
        caption: "...and a tighter tolerance should keep a value the default would chop; not yet",
      },
      {
        expr: ["Chop", ["Power", 10, -20]],
        expected: 0,
        category: "Possible issues",
        caption: "An exact small number is chopped too",
        divergence: {
          wolfram:
            "Wolfram's Chop only touches approximate numbers: $\\mathrm{Chop}[10^{-20}]$ stays $1/10^{20}$.",
        },
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
      { expr: ["Rationalize", 6.75], expected: ["Rational", 27, 4] },
      {
        expr: ["Rationalize", "Pi", 0.01],
        expected: ["Rational", 22, 7],
        caption: "A second argument sets the tolerance",
      },
      {
        expr: ["Rationalize", ["Exp", ["Sqrt", 2]], ["Power", 2, -12]],
        expected: ["Rational", 218, 53],
        category: "Scope",
        caption: "Any exact numeric expression, to any tolerance",
      },
      {
        expr: ["Rationalize", ["Sqrt", 2], 0.001],
        expected: ["Rational", 41, 29],
        category: "Scope",
      },
      { expr: ["Rationalize", -0.125], expected: ["Rational", -1, 8], category: "Scope" },
      {
        expr: ["Rationalize", "Pi", 0.001],
        expected: ["Rational", 201, 64],
        aspirational: true,
        category: "Scope",
        caption:
          "Should give the rational with the smallest denominator within 0.001 of $\\pi$, $201/64$; compute-engine returns the closer continued-fraction convergent $333/106$",
      },
      {
        expr: ["Rationalize", ["Add", 1.2, ["Multiply", 6.7, "x"]]],
        expected: ["Add", ["Multiply", ["Rational", 67, 10], "x"], ["Rational", 6, 5]],
        aspirational: true,
        category: "Scope",
        caption: "Should rationalize every approximate number inside an expression; not yet",
      },
      {
        expr: ["Rationalize", ["List", 0.5, 0.25, 0.2]],
        expected: ["List", ["Rational", 1, 2], ["Rational", 1, 4], ["Rational", 1, 5]],
        aspirational: true,
        category: "Scope",
        caption:
          "Should thread element-wise over a list; compute-engine's Rationalize takes a single real",
      },
      {
        expr: ["Rationalize", ["N", "Pi"], 0],
        expected: ["Rational", 245850922, 78256779],
        aspirational: true,
        category: "Scope",
        caption:
          "A zero tolerance should give the simplest rational exactly equal to the machine number; compute-engine returns one that is merely within an epsilon",
      },
      {
        expr: ["Rationalize", 0.618034, 0.0001],
        expected: ["Rational", 55, 89],
        category: "Applications",
        caption:
          "Recognizes a ratio of consecutive Fibonacci numbers in a decimal approximation of $1/\\varphi$",
      },
      {
        expr: ["Rationalize", ["N", "Pi"]],
        expected: ["Rational", 80143857, 25510582],
        category: "Possible issues",
        caption:
          "Without a tolerance, a float with no simple fraction nearby still becomes a fraction with a large denominator",
        divergence: {
          wolfram:
            "Wolfram returns $\\mathrm{Rationalize}[N[\\pi]]$ unchanged as 3.14159: no $p/q$ lies close enough to it, relative to $1/q^2$.",
        },
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
      { expr: ["Max", 9, 2], expected: 9 },
      { expr: ["Max", ["List", 4, 1, 7, 2]], expected: 7 },
      { expr: ["Max", 5.56, -4.8, 7.3], expected: 7.3 },
      {
        expr: [
          "Max",
          2,
          3,
          [
            "List",
            ["List", ["Rational", 1, 2], -1],
            ["List", ["Rational", -5, 3], ["Rational", 1, 2]],
          ],
        ],
        expected: 3,
        category: "Scope",
        caption: "Nested lists are flattened into the pool",
      },
      {
        expr: ["Max", ["Sqrt", 2], ["Rational", 3, 2]],
        expected: ["Rational", 3, 2],
        category: "Scope",
        caption: "Exact numbers are compared numerically",
      },
      { expr: ["Max", 1, "PositiveInfinity"], expected: "PositiveInfinity", category: "Scope" },
      {
        expr: ["Max", 3, "x", 5],
        expected: ["Max", 5, "x"],
        category: "Scope",
        caption: "The numeric arguments collapse to their maximum; symbolic ones stay",
      },
      {
        expr: ["Max", ["List", "ExponentialE", "Pi", 2]],
        expected: "Pi",
        category: "Scope",
        caption: "Compares exact constants numerically: $\\max(e, \\pi, 2) = \\pi$",
      },
      {
        expr: ["Max", ["Interval", 1, 3], ["Interval", -3, 5]],
        expected: ["Interval", 1, 5],
        aspirational: true,
        category: "Scope",
        caption:
          "The max of two [[Interval]]s should be the interval of possible maxima, $[1, 5]$; compute-engine collapses it to the number 5",
      },
      {
        expr: ["Max", "x", "x"],
        expected: "x",
        category: "Properties",
        caption: "Idempotent: $\\max(x, x) = x$",
      },
      {
        expr: ["Max", ["List"]],
        expected: "NaN",
        category: "Possible issues",
        caption: "The max of an empty list is NaN too",
        divergence: {
          wolfram: "Wolfram's $\\mathrm{Max}[\\{\\}]$ is the identity element $-\\infty$.",
        },
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
      { expr: ["Min", 9, 2], expected: 2 },
      { expr: ["Min", ["List", 4, 1, 7, 2]], expected: 1 },
      { expr: ["Min", 5.56, -4.8, 7.3], expected: -4.8 },
      {
        expr: [
          "Min",
          2,
          3,
          [
            "List",
            ["List", ["Rational", 1, 2], -1],
            ["List", ["Rational", -5, 3], ["Rational", 1, 2]],
          ],
        ],
        expected: ["Rational", -5, 3],
        category: "Scope",
        caption: "Nested lists are flattened into the pool",
      },
      {
        expr: ["Min", ["Sqrt", 2], ["Rational", 3, 2]],
        expected: ["Sqrt", 2],
        category: "Scope",
        caption: "Exact numbers are compared numerically",
      },
      {
        expr: ["Min", 3, "x", 5],
        expected: ["Min", 3, "x"],
        category: "Scope",
        caption: "The numeric arguments collapse to their minimum; symbolic ones stay",
      },
      {
        expr: ["Min", ["List", "ExponentialE", "Pi", 5]],
        expected: "ExponentialE",
        category: "Scope",
        caption: "Compares exact constants numerically: $\\min(e, \\pi, 5) = e$",
      },
      {
        expr: ["Min", ["Interval", 1, 3], ["Interval", -3, 5]],
        expected: ["Interval", -3, 3],
        aspirational: true,
        category: "Scope",
        caption:
          "The min of two [[Interval]]s should be the interval of possible minima, $[-3, 3]$; compute-engine collapses it to the number -3",
      },
      {
        expr: ["Min", "x", "x"],
        expected: "x",
        category: "Properties",
        caption: "Idempotent: $\\min(x, x) = x$",
      },
      {
        expr: ["Min"],
        expected: "PositiveInfinity",
        aspirational: true,
        category: "Possible issues",
        caption:
          "With no arguments it should return the identity element $+\\infty$; compute-engine reports a missing argument (and [[Max]] returns NaN)",
      },
      {
        expr: ["Min", ["List"]],
        expected: "NaN",
        category: "Possible issues",
        caption: "The min of an empty list is NaN",
        divergence: {
          wolfram: "Wolfram's $\\mathrm{Min}[\\{\\}]$ is the identity element $+\\infty$.",
        },
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
      { expr: ["IsOdd", 0], expected: "False" },
      {
        expr: ["IsOdd", 3.5],
        expected: "False",
        category: "Scope",
        caption: "A non-integer is not odd",
      },
      { expr: ["IsOdd", ["Rational", 1, 3]], expected: "False", category: "Scope" },
      {
        expr: ["IsOdd", ["Add", ["Power", 2, 100], 1]],
        expected: "True",
        category: "Scope",
        caption: "Big integers",
      },
      {
        expr: ["IsOdd", "Pi"],
        expected: "False",
        category: "Scope",
        caption: "$\\pi$ is known not to be an integer, so it is decided False",
      },
      {
        expr: ["IsOdd", ["List", 1, 2, 3]],
        expected: ["List", "True", "False", "True"],
        category: "Scope",
        caption: "Threads element-wise over a list",
        divergence: {
          wolfram: "OddQ tests its argument as a whole: $\\mathrm{OddQ}[\\{1, 2, 3\\}]$ is False.",
        },
      },
      {
        expr: ["Equal", ["IsOdd", 7], ["Not", ["IsEven", 7]]],
        expected: "True",
        category: "Properties",
        caption: "An integer is odd exactly when it is not even. See [[IsEven]]",
      },
      {
        expr: ["Filter", ["Range", 10], "IsOdd"],
        expected: ["List", 1, 3, 5, 7, 9],
        category: "Applications",
        caption: "Select the odd numbers up to 10",
      },
      {
        expr: ["IsOdd", "x"],
        expected: ["IsOdd", "x"],
        category: "Possible issues",
        caption: "A symbol stays undecided rather than False",
        divergence: {
          wolfram:
            "$\\mathrm{OddQ}[x]$ is False: OddQ tests the literal form, not what x might be.",
        },
      },
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
      { expr: ["IsEven", -4], expected: "True", caption: "Negative integers count too" },
      {
        expr: ["IsEven", 2.5],
        expected: "False",
        category: "Scope",
        caption: "A non-integer is not even",
      },
      {
        expr: ["IsEven", ["Power", 2, 100]],
        expected: "True",
        category: "Scope",
        caption: "Big integers",
      },
      { expr: ["IsEven", ["Factorial", 10]], expected: "True", category: "Scope" },
      {
        expr: ["IsEven", ["List", 1, 2, 3]],
        expected: ["List", "False", "True", "False"],
        category: "Scope",
        caption: "Threads element-wise over a list",
        divergence: {
          wolfram:
            "EvenQ tests its argument as a whole: $\\mathrm{EvenQ}[\\{1, 2, 3\\}]$ is False.",
        },
      },
      {
        expr: ["Xor", ["IsOdd", 12], ["IsEven", 12]],
        expected: "True",
        category: "Properties",
        caption: "Every integer is exactly one of odd and even. See [[IsOdd]]",
      },
      {
        expr: ["Filter", ["Range", 10], "IsEven"],
        expected: ["List", 2, 4, 6, 8, 10],
        category: "Applications",
        caption: "Select the even numbers up to 10",
      },
      {
        expr: ["IsEven", "x"],
        expected: ["IsEven", "x"],
        category: "Possible issues",
        caption: "A symbol stays undecided rather than False",
        divergence: {
          wolfram:
            "$\\mathrm{EvenQ}[x]$ is False: EvenQ tests the literal form, not what x might be.",
        },
      },
    ],
    seeAlso: ["IsOdd"],
  },
];
