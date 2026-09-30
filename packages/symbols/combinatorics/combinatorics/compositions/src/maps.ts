// The one combinatorial map whose `from` carrier is `composition` (step 6c). Its inverse,
// Composition (from `binary_word`), lives in `../../words/src/maps.ts` instead — a map's area
// is decided by its SOURCE carrier.

import { bind, forEach, type CombinatorialMap, type MathJSON } from "../../src/map-helpers.ts";

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
 *  after position n - j, so compositions and words are listed in the same order. */
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

export const COMPOSITIONS_MAPS: readonly CombinatorialMap[] = [
  {
    name: "CutWord",
    from: "composition",
    to: "binary_word",
    body: cutWordOf("_raw"),
    // The composition of 0 has no word: words of length n - 1 start at n = 1.
    guard: ["Greater", ["Length", "_raw"], 0],
    summary: "A composition of n as the binary word of length n - 1 marking where it is cut.",
    note: "An order isomorphism: the k-th composition of n, as IntegerCompositions lists them, goes to the k-th binary word of length n - 1.",
    laws: [{ inverse: "Composition" }],
    orderIsomorphism: { from: "IntegerCompositions", to: "BinaryWords", sizeOffset: -1 },
  },
];
