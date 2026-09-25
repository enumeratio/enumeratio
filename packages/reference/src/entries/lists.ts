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
      // Wrapped in Equal: Tabulate evaluates to a lazy collection, whose .json stays the
      // call until it is materialised. Equal compares the elements.
      {
        expr: [
          "Equal",
          ["Tabulate", ["Function", ["Power", "_1", 2]], 5],
          ["List", 1, 4, 9, 16, 25],
        ],
        expected: "True",
      },
      {
        expr: [
          "Equal",
          ["Tabulate", ["Function", ["Multiply", "_1", "_2"]], 2, 2],
          ["List", ["List", 1, 2], ["List", 2, 4]],
        ],
        expected: "True",
        category: "Scope",
        caption: "The multi-dimensional form: a rectangular grid, indexed from 1",
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
      // Wrapped in Equal: Scan is lazy too (see Tabulate).
      {
        expr: ["Equal", ["Scan", ["List", 1, 2, 3, 4], "Add"], ["List", 1, 3, 6, 10]],
        expected: "True",
      },
      {
        expr: ["Equal", ["Scan", ["List", 1, 2, 3, 4], "Max"], ["List", 1, 2, 3, 4]],
        expected: "True",
        category: "Scope",
        caption: "The running maximum",
      },
      {
        expr: ["Equal", ["Scan", ["List", 1, 2, 3], "Add", 10], ["List", 11, 13, 16]],
        expected: "True",
        category: "Possible issues",
        caption:
          "The seeded form is still the same length as $xs$ — the seed isn't an output element",
        divergence: {
          wolfram:
            "Wolfram's seeded FoldList[f, x, list] is length+1: it prepends the seed itself.",
        },
      },
    ],
    seeAlso: ["Fold"],
  },
];
