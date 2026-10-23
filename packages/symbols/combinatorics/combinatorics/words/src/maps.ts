// The one combinatorial map whose `from` carrier is `binary_word` (step 6c). Its inverse,
// CutWord (from `composition`), lives in `../../compositions/src/maps.ts` instead — a map's
// area is decided by its SOURCE carrier.

import {
  at,
  bind,
  forEach,
  type CombinatorialMap,
  type MathJSON,
  positions,
  reversedWord,
  rotatedLeft,
  rotatedRight,
} from "../../src/map-helpers.ts";

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

/** The positions where a new run of equal letters starts: the first, and each that differs from its predecessor. */
const runStarts: MathJSON = [
  "Fold",
  [
    "Function",
    [
      "If",
      ["Or", ["Equal", "p", 1], ["Not", ["Equal", at("p"), at(["Max", ["Subtract", "p", 1], 1])]]],
      ["Join", "acc", ["List", "p"]],
      "acc",
    ],
    "acc",
    "p",
  ],
  ["List"],
  positions,
];

export const WORDS_MAPS: readonly CombinatorialMap[] = [
  {
    name: "Reverse",
    from: "binary_word",
    to: "binary_word",
    body: reversedWord,
    summary: "The word read backwards.",
  },
  {
    name: "Complement",
    from: "binary_word",
    to: "binary_word",
    body: forEach(positions, ["Subtract", 1, at("i")]),
    summary: "Each letter swapped for the other: 0 for 1 and 1 for 0.",
  },
  {
    name: "CyclicShift",
    from: "binary_word",
    to: "binary_word",
    body: rotatedLeft,
    summary: "Rotate the word one place to the left: the first letter moves to the end.",
  },
  {
    name: "InverseCyclicShift",
    from: "binary_word",
    to: "binary_word",
    body: rotatedRight,
    summary: "Rotate the word one place to the right: the last letter moves to the front.",
  },
  {
    name: "Composition",
    convert: true,
    from: "binary_word",
    to: "composition",
    body: compositionOfCutWord("_raw"),
    summary: "The composition of m + 1 a binary word of length m cuts out.",
    note: "The inverse of CutWord. Mapped over BinaryWords(m), it lists the compositions of m + 1 in their cut words' order.",
  },
  {
    name: "Finset",
    convert: true,
    from: "binary_word",
    to: "finset",
    // Finset's shape is params-first: n as `body`, the members as the sole `extra`.
    body: ["Length", "_raw"],
    extra: [["Filter", ["Range", 1, ["Length", "_raw"], 1], ["Function", ["Equal", ["At", "_raw", "i"], 1], "i"]]],
    summary: "The subset of 1..m a binary word of length m marks: the positions holding 1.",
    note: "The inverse of BinaryWord(finset). Mapped over BinaryWords(m), it lists the subsets of 1..m in their characteristic words' order.",
  },
  {
    name: "RunComposition",
    from: "binary_word",
    to: "composition",
    body: [
      "If",
      ["Equal", ["Length", "_raw"], 0],
      ["List"],
      bind(
        "starts",
        runStarts,
        bind(
          "bounds",
          ["Join", "starts", ["List", ["Add", ["Length", "_raw"], 1]]],
          forEach(
            ["Range", 1, ["Length", "starts"], 1],
            ["Subtract", at(["Add", "q", 1], "bounds"), at("q", "bounds")],
            "q",
          ),
          "list<integer>",
        ),
        "list<integer>",
      ),
    ],
    summary: "The lengths of the maximal runs of equal letters, left to right.",
    note: "FindStat's Mp00097, the delta morphism. Lossy: it forgets the first letter, so each composition has two words.",
  },
  {
    name: "Twist",
    from: "binary_word",
    to: "binary_word",
    body: forEach(positions, ["If", ["Equal", "i", 1], ["Subtract", 1, at("i")], at("i")]),
    summary: "The first letter swapped for the other.",
    note: "FindStat's Mp00200, an involution.",
  },
  {
    name: "AlternatingComplement",
    from: "binary_word",
    to: "binary_word",
    body: forEach(positions, ["If", ["Equal", ["Mod", "i", 2], 0], ["Subtract", 1, at("i")], at("i")]),
    summary: "Every second letter swapped for the other, starting with the second.",
    note: 'FindStat\'s Mp00158, "alternating inverse", an involution.',
  },
];
