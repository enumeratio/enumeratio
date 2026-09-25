import type { ReferenceEntry } from "../types.ts";

export const lists: readonly ReferenceEntry[] = [
  {
    name: "All",
    domain: "Collections",
    signature: "All(xs, predicate)",
    summary: "Whether every element of a collection satisfies a predicate.",
    signatures: [
      {
        call: "All(xs, predicate)",
        description: "$True$ if $predicate$ holds for every element of $xs$, else $False$.",
      },
    ],
    examples: [
      {
        expr: ["All", ["List", 2, 4, 6], ["Function", ["Equal", ["Mod", "_1", 2], 0]]],
        expected: "True",
      },
      {
        expr: ["All", ["List", 2, 4, 5], ["Function", ["Equal", ["Mod", "_1", 2], 0]]],
        expected: "False",
      },
      {
        expr: ["All", ["List", 2, 3, 5, 7], "IsPrime"],
        expected: "True",
        caption: "A named predicate",
      },
      { expr: ["All", ["List", 1, 2, 3], ["Function", ["Greater", "_1", 0]]], expected: "True" },
      {
        expr: ["All", ["List", 1, "x"], "IsEven"],
        expected: "False",
        category: "Scope",
        caption: "One definite failure decides the answer, even beside a symbolic element",
      },
      {
        expr: ["All", ["List", "True", "True"]],
        expected: "True",
        category: "Scope",
        caption: "Without a predicate, tests the elements themselves",
        divergence: {
          wolfram: "AllTrue needs a test; $\\mathrm{AllTrue}[\\{True, True\\}]$ stays unevaluated.",
        },
      },
      {
        expr: [
          "All",
          ["List", ["List", 1, 2], ["List", 3, 4]],
          ["Function", ["Greater", "_1", 0]],
          2,
        ],
        expected: "True",
        aspirational: true,
        category: "Scope",
        caption:
          "A level argument should test the elements at depth 2 of a nested list; not yet supported",
      },
      {
        expr: ["All", ["List"], "IsEven"],
        expected: "True",
        category: "Properties",
        caption: "Vacuously true on an empty list",
      },
    ],
    seeAlso: ["Any"],
  },
  {
    name: "Any",
    domain: "Collections",
    signature: "Any(xs, predicate)",
    summary: "Whether some element of a collection satisfies a predicate.",
    signatures: [
      {
        call: "Any(xs, predicate)",
        description: "$True$ if $predicate$ holds for at least one element of $xs$, else $False$.",
      },
    ],
    examples: [
      {
        expr: ["Any", ["List", 1, 3, 5], ["Function", ["Equal", ["Mod", "_1", 2], 0]]],
        expected: "False",
      },
      {
        expr: ["Any", ["List", 1, 3, 6], ["Function", ["Equal", ["Mod", "_1", 2], 0]]],
        expected: "True",
      },
      {
        expr: ["Any", ["List", 4, 6, 7], "IsPrime"],
        expected: "True",
        caption: "A named predicate",
      },
      { expr: ["Any", ["List", 1, 2, 3], ["Function", ["Greater", "_1", 2]]], expected: "True" },
      {
        expr: ["Any", ["List", "False", "True"]],
        expected: "True",
        category: "Scope",
        caption: "Without a predicate, tests the elements themselves",
        divergence: {
          wolfram:
            "AnyTrue needs a test; $\\mathrm{AnyTrue}[\\{False, True\\}]$ stays unevaluated.",
        },
      },
      {
        expr: [
          "Any",
          ["List", ["List", 1, 2], ["List", 3, -4]],
          ["Function", ["Less", "_1", 0]],
          2,
        ],
        expected: "True",
        aspirational: true,
        category: "Scope",
        caption:
          "A level argument should test the elements at depth 2 of a nested list; not yet supported",
      },
      {
        expr: ["Any", ["List"], "IsEven"],
        expected: "False",
        category: "Properties",
        caption: "Always false on an empty list",
      },
      {
        expr: [
          "Equal",
          ["Any", ["List", 1, 3, 5], "IsEven"],
          ["Not", ["All", ["List", 1, 3, 5], "IsOdd"]],
        ],
        expected: "True",
        category: "Properties",
        caption: "Some element passes exactly when not every element fails. See [[All]]",
      },
    ],
    seeAlso: ["All"],
  },
  {
    name: "Fold",
    domain: "Collections",
    signature: "Fold(f, init, xs)",
    summary: "Reduce a collection to one value, combining left to right from a seed.",
    signatures: [
      {
        call: "Fold(f, init, xs)",
        description:
          "$f(\\ldots f(f(init, x_1), x_2)\\ldots, x_n)$ — $init$ combined with each element of $xs$ in turn.",
      },
    ],
    examples: [
      {
        expr: ["Fold", "Add", 0, ["List", 1, 2, 3, 4]],
        expected: 10,
      },
      {
        expr: ["Fold", "Multiply", 1, ["List", 1, 2, 3, 4]],
        expected: 24,
      },
      {
        expr: ["Fold", "f", "x", ["List", "a", "b", "c"]],
        expected: ["f", ["f", ["f", "x", "a"], "b"], "c"],
        caption: "The shape of a left fold",
      },
      { expr: ["Fold", "Max", 0, ["List", 3, 1, 4, 1, 5]], expected: 5 },
      {
        expr: ["Fold", "Add", 0, ["List", "a", "b", "c"]],
        expected: ["Add", "a", "b", "c"],
        category: "Scope",
        caption: "Symbolic elements",
      },
      {
        expr: ["Fold", ["Function", ["List", "_1", "_2"]], "x", ["List", "a", "b"]],
        expected: ["List", ["List", "x", "a"], "b"],
        category: "Scope",
        caption: "Any two-argument function, here one that nests pairs",
      },
      {
        expr: ["Fold", "f", ["List", "a", "b", "c"]],
        expected: ["f", ["f", "a", "b"], "c"],
        aspirational: true,
        category: "Scope",
        caption:
          "Without a seed it should start from the first element; the 2-argument form isn't supported yet",
      },
      {
        expr: ["Fold", "f", "x", ["List"]],
        expected: "x",
        category: "Properties",
        caption: "Folding an empty list returns the seed",
      },
      {
        expr: ["Fold", "Add", 0, ["Range", 100]],
        expected: 5050,
        category: "Properties",
        caption: "Folding with Add is a sum: $1 + 2 + \\cdots + 100$",
      },
      {
        expr: [
          "Fold",
          ["Function", ["Add", ["Multiply", 10, "_1"], "_2"]],
          0,
          ["List", 1, 2, 3, 4],
        ],
        expected: 1234,
        category: "Applications",
        caption: "Assemble a number from its decimal digits",
      },
      {
        expr: ["Fold", ["Function", ["Add", ["Multiply", 2, "_1"], "_2"]], 0, ["List", 1, 0, 1, 1]],
        expected: 11,
        category: "Applications",
        caption: "...or from its binary digits: $1011_2 = 11$",
      },
      {
        expr: [
          "Fold",
          ["Function", ["Add", ["Multiply", "x", "_1"], "_2"]],
          0,
          ["List", "a", "b", "c"],
        ],
        expected: ["Add", ["Multiply", "x", ["Add", ["Multiply", "a", "x"], "b"]], "c"],
        category: "Applications",
        caption: "Horner's rule for $ax^2 + bx + c$",
      },
      {
        expr: ["Fold", ["Function", ["Add", "_2", ["Divide", 1, "_1"]]], 2, ["List", 2, 2, 1]],
        expected: ["Rational", 17, 12],
        category: "Applications",
        caption:
          "Evaluate the continued fraction $[1; 2, 2, 2]$ from the inside out -- a convergent of $\\sqrt{2}$",
      },
    ],
    seeAlso: ["Scan"],
  },
  {
    name: "Tabulate",
    domain: "Collections",
    signature: "Tabulate(f, n)",
    summary: "The list of $f$ applied to each index from 1 to $n$ (or a rectangular grid of them).",
    signatures: [
      {
        call: "Tabulate(f, n)",
        description: "$[f(1), f(2), \\ldots, f(n)]$.",
      },
      {
        call: "Tabulate(f, n, m, …)",
        description:
          "the nested array of $f$ applied to every index tuple in the $n \\times m \\times \\ldots$ grid, each 1-based.",
      },
    ],
    examples: [
      {
        expr: ["Tabulate", ["Function", ["Power", "_1", 2]], 5],
        expected: ["List", 1, 4, 9, 16, 25],
      },
      {
        expr: ["Tabulate", ["Function", ["Multiply", "_1", "_2"]], 2, 2],
        expected: ["List", ["List", 1, 2], ["List", 2, 4]],
        category: "Scope",
        caption: "The multi-dimensional form: a rectangular grid, indexed from 1",
      },
      {
        expr: ["Tabulate", "f", 3],
        expected: ["List", ["f", 1], ["f", 2], ["f", 3]],
        caption: "A symbolic function shows the indices",
      },
      {
        expr: ["Tabulate", "f", 2, 3],
        expected: [
          "List",
          ["List", ["f", 1, 1], ["f", 1, 2], ["f", 1, 3]],
          ["List", ["f", 2, 1], ["f", 2, 2], ["f", 2, 3]],
        ],
        category: "Scope",
        caption: "A 2×3 grid",
      },
      {
        expr: ["Tabulate", "Add", 2, 2],
        expected: ["List", ["List", 2, 3], ["List", 3, 4]],
        category: "Scope",
      },
      {
        expr: ["Tabulate", "f", 2, 2, 2],
        expected: [
          "List",
          [
            "List",
            ["List", ["f", 1, 1, 1], ["f", 1, 1, 2]],
            ["List", ["f", 1, 2, 1], ["f", 1, 2, 2]],
          ],
          [
            "List",
            ["List", ["f", 2, 1, 1], ["f", 2, 1, 2]],
            ["List", ["f", 2, 2, 1], ["f", 2, 2, 2]],
          ],
        ],
        aspirational: true,
        category: "Scope",
        caption:
          "Three dimensions should give a 2×2×2 array; compute-engine drops the third dimension",
      },
      {
        expr: ["Tabulate", "f", 0],
        expected: ["List"],
        aspirational: true,
        category: "Scope",
        caption: "Length 0 should give the empty list; it stays unevaluated",
      },
      {
        expr: ["Tabulate", ["Function", ["Divide", 1, ["Subtract", ["Add", "_1", "_2"], 1]]], 3, 3],
        expected: [
          "List",
          ["List", 1, ["Rational", 1, 2], ["Rational", 1, 3]],
          ["List", ["Rational", 1, 2], ["Rational", 1, 3], ["Rational", 1, 4]],
          ["List", ["Rational", 1, 3], ["Rational", 1, 4], ["Rational", 1, 5]],
        ],
        category: "Applications",
        caption: "The 3×3 Hilbert matrix, $1/(i+j-1)$",
      },
      {
        expr: ["Tabulate", ["Function", ["If", ["Equal", "_1", "_2"], 1, 0]], 3, 3],
        expected: ["List", ["List", 1, 0, 0], ["List", 0, 1, 0], ["List", 0, 0, 1]],
        category: "Applications",
        caption: "The 3×3 identity matrix",
      },
      {
        expr: ["Tabulate", "Binomial", 3, 3],
        expected: ["List", ["List", 1, 0, 0], ["List", 2, 1, 0], ["List", 3, 3, 1]],
        category: "Applications",
        caption: "Pascal's triangle as a lower-triangular matrix",
      },
    ],
  },
  {
    name: "Scan",
    domain: "Collections",
    signature: "Scan(xs, f)",
    summary: "The running combination of $f$ over a collection, one result per element.",
    signatures: [
      {
        call: "Scan(xs, f)",
        description:
          "$[f(x_1), f(f(x_1), x_2), \\ldots]$ — same length as $xs$, the partial folds of $f$ with no seed.",
      },
      {
        call: "Scan(xs, f, init)",
        description:
          "as above, but folding from $init$ — still same length as $xs$ (the seed is not itself an output element).",
      },
    ],
    examples: [
      {
        expr: ["Scan", ["List", 1, 2, 3, 4], "Add"],
        expected: ["List", 1, 3, 6, 10],
      },
      {
        expr: ["Scan", ["List", 1, 2, 3, 4], "Max"],
        expected: ["List", 1, 2, 3, 4],
        category: "Scope",
        caption: "The running maximum",
      },
      {
        expr: ["Scan", ["List", 1, 2, 3], "Add", 10],
        expected: ["List", 11, 13, 16],
        category: "Possible issues",
        caption:
          "The seeded form is still the same length as $xs$ — the seed isn't an output element",
        divergence: {
          wolfram:
            "Wolfram's seeded FoldList[f, x, list] is length+1: it prepends the seed itself.",
        },
      },
      {
        expr: ["Scan", ["List", "a", "b", "c"], "f"],
        expected: ["List", "a", ["f", "a", "b"], ["f", ["f", "a", "b"], "c"]],
        caption: "The shape of a running fold",
      },
      {
        expr: ["Scan", ["List", 1, 2, 3, 4, 5], "Multiply"],
        expected: ["List", 1, 2, 6, 24, 120],
        category: "Scope",
        caption: "Running products: the factorials",
      },
      {
        expr: ["Scan", ["List", "a", "b", "c"], "Add"],
        expected: ["List", "a", ["Add", "a", "b"], ["Add", "a", "b", "c"]],
        category: "Scope",
        caption: "Running sums of symbolic elements -- Wolfram's Accumulate",
      },
      {
        expr: ["Scan", ["List", 3, 1, 4, 1, 5], "Min"],
        expected: ["List", 3, 1, 1, 1, 1],
        category: "Scope",
        caption: "The running minimum",
      },
      {
        expr: ["Scan", ["List"], "Add"],
        expected: ["List"],
        category: "Scope",
        caption: "An empty list scans to an empty list",
      },
      {
        expr: ["Scan", ["List", 1, 0, 1, 1], ["Function", ["Add", ["Multiply", 2, "_1"], "_2"]]],
        expected: ["List", 1, 2, 5, 11],
        category: "Applications",
        caption: "The values of every prefix of the binary digits 1011",
      },
    ],
    seeAlso: ["Fold"],
  },
  {
    name: "Contains",
    domain: "Collections",
    signature: "Contains(xs, v)",
    summary: "Whether a collection has an element structurally equal to v.",
    signatures: [
      {
        call: "Contains(xs, v)",
        description: "$True$ if some element of $xs$ is structurally equal to $v$, else $False$.",
      },
    ],
    examples: [
      { expr: ["Contains", ["List", 1, 2, 3], 2], expected: "True" },
      { expr: ["Contains", ["List", 1, 2, 3], 5], expected: "False" },
      { expr: ["Contains", ["List", 1, 3, 4, 1, 2], 2], expected: "True" },
      {
        expr: ["Contains", ["List"], "x"],
        expected: "False",
        caption: "Nothing is in the empty list",
      },
      {
        expr: ["Contains", ["List", ["Power", "x", 2], ["Power", "y", 2]], ["Power", "x", 2]],
        expected: "True",
        category: "Scope",
        caption: "Symbolic elements",
      },
      {
        expr: ["Contains", ["List", ["List", 1, 2], ["List", 3, 4]], ["List", 1, 2]],
        expected: "True",
        category: "Scope",
        caption: "Elements can themselves be lists",
      },
      {
        expr: ["Contains", ["List", ["List", 1, 2], ["List", 3, 4]], 1],
        expected: "False",
        category: "Scope",
        caption: "Only the top-level elements are searched",
      },
      {
        expr: ["Contains", ["List", ["Add", "a", "b"]], ["Add", "b", "a"]],
        expected: "True",
        category: "Properties",
        caption: "Compared after canonical ordering, so $b + a$ matches $a + b$",
      },
      {
        expr: ["Contains", ["List", ["Rational", 1, 2]], 0.5],
        expected: "True",
        category: "Possible issues",
        caption: "An exact and an approximate number with the same value match",
        divergence: {
          wolfram: "MemberQ compares structurally: $\\mathrm{MemberQ}[\\{1/2\\}, 0.5]$ is False.",
        },
      },
      {
        expr: ["Contains", ["Range", 100], 50],
        expected: "True",
        category: "Scope",
        caption: "A lazy [[Range]] is searched without being materialised",
      },
    ],
    seeAlso: ["Any"],
  },
  {
    name: "Unique",
    domain: "Collections",
    signature: "Unique(xs)",
    summary: "The elements of a collection, each kept once, in first-occurrence order.",
    signatures: [
      {
        call: "Unique(xs)",
        description: "$xs$ with every repeat of an element dropped, keeping the first occurrence.",
      },
    ],
    examples: [
      {
        expr: ["Unique", ["List", 1, 2, 2, 3, 1]],
        expected: ["List", 1, 2, 3],
      },
      { expr: ["Unique", ["List", "a", "b", "a", "c", "b"]], expected: ["List", "a", "b", "c"] },
      {
        expr: ["Unique", ["List", 1, 7, 8, 4, 3, 4, 1, 9, 9, 2, 1]],
        expected: ["List", 1, 7, 8, 4, 3, 9, 2],
        caption: "Keeps first-occurrence order, without sorting",
      },
      {
        expr: ["Unique", ["List", ["List", 1, 2], ["List", 1, 2], ["List", 3]]],
        expected: ["List", ["List", 1, 2], ["List", 3]],
        category: "Scope",
        caption: "Elements can themselves be lists",
      },
      { expr: ["Unique", ["List"]], expected: ["List"], category: "Scope" },
      {
        expr: [
          "Unique",
          ["List", 1, 2, 3, 4, 5, 6],
          ["Function", ["Less", ["Abs", ["Subtract", "_1", "_2"]], 2]],
        ],
        expected: ["List", 1, 3, 5],
        aspirational: true,
        category: "Scope",
        caption:
          "A second argument should say when two elements count as duplicates -- here, when they differ by less than 2; not yet supported",
      },
      {
        expr: ["Unique", ["Unique", ["List", 1, 1, 2]]],
        expected: ["List", 1, 2],
        category: "Properties",
        caption: "Idempotent",
      },
      {
        expr: ["Length", ["Unique", ["List", 1, 2, 2, 3, 3, 3]]],
        expected: 3,
        category: "Applications",
        caption: "Count the distinct elements",
      },
      {
        expr: ["Unique", ["Mod", ["Range", 10], 3]],
        expected: ["List", 1, 2, 0],
        category: "Applications",
        caption: "The residues mod 3 that occur, in order of first appearance",
      },
    ],
  },
];
