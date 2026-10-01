// The one combinatorial map whose `from` carrier is `binary_word` (step 6c). Its inverse,
// CutWord (from `composition`), lives in `../../compositions/src/maps.ts` instead — a map's
// area is decided by its SOURCE carrier.

import { bind, forEach, type CombinatorialMap, type MathJSON } from "../../src/map-helpers.ts";

/** The composition of m + 1 a cut word of length m describes: the parts between the cuts. */
const compositionOfCutWord = (word: MathJSON): MathJSON =>
  bind(
    "bounds",
    [
      "Join",
      ["List", 0],
      [
        "Fold",
        [
          "Function",
          [
            "If",
            ["Equal", ["At", word, ["Subtract", ["Add", ["Length", word], 1], "p"]], 1],
            ["Join", "acc", ["List", "p"]],
            "acc",
          ],
          "acc",
          "p",
        ],
        ["List"],
        ["Range", 1, ["Length", word], 1],
      ],
      ["List", ["Add", ["Length", word], 1]],
    ],
    forEach(
      ["Range", 1, ["Subtract", ["Length", "bounds"], 1], 1],
      ["Subtract", ["At", "bounds", ["Add", "q", 1]], ["At", "bounds", "q"]],
      "q",
    ),
  );

export const WORDS_MAPS: readonly CombinatorialMap[] = [
  {
    name: "Composition",
    convert: true,
    from: "binary_word",
    to: "composition",
    body: compositionOfCutWord("_raw"),
    summary: "The composition of m + 1 a binary word of length m cuts out.",
    note: "The inverse of CutWord. Mapped over BinaryWords(m), it lists the compositions of m + 1 in their cut words' order.",
  },
];
