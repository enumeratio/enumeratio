// The one combinatorial map whose `from` carrier is `composition` (step 6c). Its inverse,
// Composition (from `binary_word`), lives in `../../words/src/maps.ts` instead — a map's area
// is decided by its SOURCE carrier.

import {
  at,
  bind,
  descending,
  forEach,
  type CombinatorialMap,
  type MathJSON,
  reversedWord,
  rotatedLeft,
  rotatedRight,
} from "../../src/map-helpers.ts";

/** A composition's partial sums, folded into a list. */
const partialSums = (parts: MathJSON): MathJSON => [
  "Fold",
  [
    "Function",
    ["Join", "acc", ["List", ["Add", ["If", ["Equal", ["Length", "acc"], 0], 0, ["Last", "acc"]], ["At", parts, "i"]]]],
    "acc",
    "i",
  ],
  ["List"],
  ["Range", 1, ["Length", parts], 1],
];

/** A composition's size, n: the sum of its parts. */
const sizeOf = (parts: MathJSON): MathJSON => [
  "Fold",
  ["Function", ["Add", "acc", ["At", parts, "i"]], "acc", "i"],
  0,
  ["Range", 1, ["Length", parts], 1],
];

/** A composition of n as its cut word of length n - 1: bit j is 1 when the composition is cut
 *  after position n - j. `BinaryWords(n - 1)` through `Composition(word)` lists compositions in
 *  the order of these words, which is not `IntegerCompositions`' lex order. */
const cutWordOf = (parts: MathJSON): MathJSON =>
  // `bind` spreads a list across the function's parameters, so the partial sums are inlined.
  bind("cn", sizeOf(parts), [
    "If",
    // n = 1: the empty word, and no range to walk.
    ["Less", "cn", 2],
    ["List"],
    forEach(
      ["Range", 1, ["Subtract", "cn", 1], 1],
      ["If", ["Element", ["Subtract", "cn", "j"], partialSums(parts)], 1, 0],
      "j",
    ),
  ]);

/** The composition whose cuts are exactly the positions 1 .. n - 1 `parts` leaves uncut. Below
 *  size 2 there is no position to flip, so the composition is its own complement. */
const complementOf = (parts: MathJSON): MathJSON =>
  bind("cn", sizeOf(parts), [
    "If",
    ["Less", "cn", 2],
    parts,
    bind(
      "bounds",
      [
        "Join",
        ["List", 0],
        [
          "Filter",
          ["Range", 1, ["Subtract", "cn", 1], 1],
          ["Function", ["Not", ["Element", "k", partialSums(parts)]], "k"],
        ],
        ["List", "cn"],
      ],
      forEach(
        ["Range", 1, ["Subtract", ["Length", "bounds"], 1], 1],
        ["Subtract", at(["Add", "q", 1], "bounds"), at("q", "bounds")],
        "q",
      ),
      "list<integer>",
    ),
  ]);

export const COMPOSITIONS_MAPS: readonly CombinatorialMap[] = [
  {
    name: "Reverse",
    from: "composition",
    to: "composition",
    body: reversedWord,
    summary: "The parts read backwards.",
  },
  {
    name: "Complement",
    from: "composition",
    to: "composition",
    body: complementOf("_raw"),
    summary: "The composition cut exactly where this one is not: its cut set complemented.",
    note: "Reverse then complement is TransposeComposition, and reversing commutes with complementing.",
  },
  {
    name: "TransposeComposition",
    from: "composition",
    to: "composition",
    composedOf: ["Complement", "Reverse"],
    summary: "The conjugate composition: its ribbon shape transposed, the complement of the reverse.",
    note: "FindStat's \"conjugate\" on compositions, named for TransposePartition and TransposeTableau: Conjugate is already the complex conjugate. hopf's ConjugateComposition is the same operation on a plain list of parts.",
  },
  {
    name: "CyclicShift",
    from: "composition",
    to: "composition",
    body: rotatedLeft,
    summary: "Rotate the parts one place to the left: the first part moves to the end.",
  },
  {
    name: "InverseCyclicShift",
    from: "composition",
    to: "composition",
    body: rotatedRight,
    summary: "Rotate the parts one place to the right: the last part moves to the front.",
  },
  {
    name: "IntegerPartition",
    convert: true,
    from: "composition",
    to: "integer_partition",
    body: descending("_raw"),
    summary: "The partition a composition's parts form, sorted largest first.",
    findstat: ["Mp00040"],
  },
  {
    name: "CutWord",
    from: "composition",
    to: "binary_word",
    body: cutWordOf("_raw"),
    // The composition of 0 has no word: words of length n - 1 start at n = 1.
    guard: ["Greater", ["Length", "_raw"], 0],
    summary: "A composition of n as the binary word of length n - 1 marking where it is cut.",
    note: "Not order-preserving: IntegerCompositions lists compositions lex on their parts, while BinaryWords(n - 1) through Composition(word) gives them in their cut words' order.",
  },
];
