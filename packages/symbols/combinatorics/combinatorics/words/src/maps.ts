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
  runLengths,
  sortedRuns,
} from "../../src/map-helpers.ts";
import { foataInversionsToMajorBody, foataMajorToInversionsBody } from "../../permutations/src/foata-bijection.ts";

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

const n: MathJSON = ["Length", "_raw"];
const upTo = (m: MathJSON): MathJSON => ["Range", 1, m, 1];
/** `m` copies of `x`. */
const fill = (x: MathJSON, m: MathJSON): MathJSON => forEach(upTo(m), x, "z");
/** The number of ones. */
const ones: MathJSON = ["Count", ["Filter", "_raw", ["Function", ["Equal", "x", 1], "x"]]];
/** The first position holding a 1, when there is one. */
const firstOne: MathJSON = ["First", ["Filter", positions, ["Function", ["Equal", at("p"), 1], "p"]]];
/** The word with letter k flipped. */
const flippedAt = (k: MathJSON): MathJSON =>
  forEach(positions, ["If", ["Equal", "i", k], ["Subtract", 1, at("i")], at("i")]);

/** Mp00272: with an even number of ones flip the first letter; otherwise flip the letter after the first one,
 *  unless that one is last, which gives the zero word. */
const grayNextBody: MathJSON = [
  "If",
  ["Equal", n, 0],
  ["List"],
  bind(
    "ones",
    ones,
    [
      "If",
      ["Equal", ["Mod", "ones", 2], 0],
      flippedAt(1),
      bind("first", firstOne, ["If", ["Equal", "first", n], fill(0, n), flippedAt(["Add", "first", 1])], "integer"),
    ],
    "integer",
  ),
];

/** Mp00273: with an odd number of ones flip the first letter; the zero word gets its last letter flipped;
 *  otherwise flip the letter after the first one. */
const grayPreviousBody: MathJSON = [
  "If",
  ["Equal", n, 0],
  ["List"],
  bind(
    "ones",
    ones,
    [
      "If",
      ["Equal", ["Mod", "ones", 2], 1],
      flippedAt(1),
      ["If", ["Equal", "ones", 0], flippedAt(n), flippedAt(["Add", firstOne, 1])],
    ],
    "integer",
  ),
];

/** Whether position q starts a valley 01, and whether it ends one. */
const startsValley = (q: MathJSON): MathJSON => [
  "And",
  ["Less", q, n],
  ["Equal", at(q), 0],
  ["Equal", at(["Min", ["Add", q, 1], n]), 1],
];
const endsValley = (q: MathJSON): MathJSON => [
  "And",
  ["Greater", q, 1],
  ["Equal", at(["Max", ["Subtract", q, 1], 1]), 0],
  ["Equal", at(q), 1],
];

/** Mp00234: each valley 01 becomes a peak 10, and a trailing 0 becomes 1. */
const valleysToPeaksBody: MathJSON = forEach(positions, [
  "If",
  startsValley("i"),
  1,
  ["If", endsValley("i"), 0, ["If", ["And", ["Equal", "i", n], ["Equal", at("i"), 0]], 1, at("i")]],
]);

/** Mp00278: cut at every valley 01 (they never overlap), reverse the stretches between, and put 10 where each valley
 *  was. Every piece keeps its place, so a position outside a valley takes the letter mirrored across its stretch. */
const rowmotionBody: MathJSON = forEach(positions, [
  "If",
  startsValley("i"),
  1,
  [
    "If",
    endsValley("i"),
    0,
    bind(
      "stretch_start",
      [
        "Add",
        1,
        ["Max", ["Join", ["List", 0], ["Filter", upTo(["Subtract", "i", 1]), ["Function", endsValley("q"), "q"]]]],
      ],
      bind(
        "stretch_end",
        [
          "Subtract",
          [
            "Min",
            ["Join", ["Filter", ["Range", "i", n, 1], ["Function", startsValley("q"), "q"]], ["List", ["Add", n, 1]]],
          ],
          1,
        ],
        at(["Subtract", ["Add", "stretch_start", "stretch_end"], "i"]),
        "integer",
      ),
      "integer",
    ),
  ],
]);

/** Counted ones before position `p`: those after the last valley's one, and not themselves the one of a valley. */
const pendingBefore = (p: MathJSON): MathJSON => [
  "Count",
  [
    "Filter",
    [
      "Range",
      [
        "Add",
        ["Max", ["Join", ["List", 0], ["Filter", upTo(["Subtract", p, 1]), ["Function", startsValley("q"), "q"]]]],
        1,
      ],
      ["Subtract", p, 1],
      1,
    ],
    [
      "Function",
      ["And", ["Equal", at("r"), 1], ["Or", ["Equal", "r", 1], ["Equal", at(["Max", ["Subtract", "r", 1], 1]), 1]]],
      "r",
    ],
  ],
];

/** Mp00280: each zero that starts a valley, or ends the word, emits a one for every pending one and one more; a valley
 *  also emits its zero. Other zeros emit themselves; ones are held back, and flushed as zeros at the end. */
const pathRowmotionBody: MathJSON = bind(
  "emitted",
  [
    "Flatten",
    forEach(positions, [
      "If",
      ["Equal", at("i"), 1],
      ["List"],
      [
        "If",
        ["Equal", "i", n],
        fill(1, ["Add", pendingBefore("i"), 1]),
        ["If", startsValley("i"), ["Join", fill(1, ["Add", pendingBefore("i"), 1]), ["List", 0]], ["List", 0]],
      ],
    ]),
  ],
  ["Join", "emitted", fill(0, ["Subtract", n, ["Length", "emitted"]])],
  "list<integer>",
);

/** Mp00268, with the zeros' positions z_1 < z_2 < ... and b_k the ones between z_{k-1} and z_k: the stretches
 *  1^b_1, 0^b_2 01, 1^b_3, ... then the letter the next stretch would be, to the length n; read backwards. */
export const zerosToFlagZerosBody: MathJSON = bind(
  "zeros",
  ["Filter", positions, ["Function", ["Equal", at("p"), 0], "p"]],
  bind(
    "stretches",
    [
      "Flatten",
      forEach(
        upTo(["Length", "zeros"]),
        bind(
          "gap",
          [
            "Subtract",
            ["Subtract", at("k", "zeros"), ["If", ["Equal", "k", 1], 0, at(["Max", ["Subtract", "k", 1], 1], "zeros")]],
            1,
          ],
          ["If", ["Equal", ["Mod", "k", 2], 1], fill(1, "gap"), ["Join", fill(0, ["Add", "gap", 1]), ["List", 1]]],
          "integer",
        ),
        "k",
      ),
    ],
    bind(
      "word",
      [
        "Join",
        "stretches",
        fill(["If", ["Equal", ["Mod", ["Length", "zeros"], 2], 0], 1, 0], ["Subtract", n, ["Length", "stretches"]]),
      ],
      forEach(positions, at(["Subtract", ["Add", n, 1], "i"], "word")),
      "list<integer>",
    ),
    "list<integer>",
  ),
  "list<integer>",
);

/** Mp00269, the inverse: a 0 at position p exactly when the letter before p, counting from the right end, differs from
 *  the one after it, the word ending in a 1 that is not there. */
export const flagZerosToZerosBody: MathJSON = forEach(positions, [
  "If",
  ["Equal", ["If", ["Equal", "i", 1], 1, at(["Subtract", ["Add", n, 2], "i"])], at(["Subtract", ["Add", n, 1], "i"])],
  1,
  0,
]);

/** Mp00178: with a 1 put in front, each 1 opens a part, of 1 plus the zeros after it. */
const codeCompositionBody: MathJSON = bind(
  "starts",
  [
    "Join",
    ["List", 1],
    ["Map", ["Function", ["Add", "p", 1], "p"], ["Filter", positions, ["Function", ["Equal", at("p"), 1], "p"]]],
  ],
  bind(
    "bounds",
    ["Join", "starts", ["List", ["Add", n, 2]]],
    forEach(upTo(["Length", "starts"]), ["Subtract", at(["Add", "q", 1], "bounds"), at("q", "bounds")], "q"),
    "list<integer>",
  ),
  "list<integer>",
);

/** Mp00056: the support Dyck path of a parking function: its i-th up step, counting the sorted entries from
 *  1, comes after s_i - 1 downs, so it sits at position s_i + i - 1. */
const supportDyckPathBody: MathJSON = [
  "If",
  ["Equal", ["Length", "_raw"], 0],
  ["List"],
  bind(
    "sd_ups",
    forEach(["Range", 1, ["Length", "_raw"], 1], ["Subtract", ["Add", ["At", ["Sort", "_raw"], "i"], "i"], 1]),
    forEach(["Range", 1, ["Multiply", 2, ["Length", "_raw"]], 1], ["If", ["Element", "p", "sd_ups"], 1, 0], "p"),
    "list<integer>",
  ),
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
    body: runLengths,
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
  {
    name: "RunSort",
    from: "binary_word",
    to: "binary_word",
    // A run is 0^a 1^b. Lexicographically, a run without ones sorts before any run with ones (it is a prefix of, or
    // differs from it by an earlier 0), and shorter before longer; runs with ones sort by more zeros first, then
    // fewer ones.
    body: sortedRuns((first, last) =>
      bind(
        "zeros",
        ["Count", ["Filter", ["Range", first, last, 1], ["Function", ["Equal", at("q"), 0], "q"]]],
        [
          "If",
          ["Equal", "zeros", ["Add", ["Subtract", last, first], 1]],
          "zeros",
          [
            "Add",
            ["Length", "_raw"],
            1,
            ["Multiply", ["Subtract", ["Length", "_raw"], "zeros"], ["Add", ["Length", "_raw"], 1]],
            ["Subtract", ["Add", ["Subtract", last, first], 1], "zeros"],
          ],
        ],
        "integer",
      ),
    ),
    summary: "The word with its weakly increasing runs sorted lexicographically.",
    note: "FindStat's Mp00224. Lossy: the runs' order is forgotten. The runs are the maximal stretches 0...01...1.",
  },
  {
    name: "GrayNext",
    from: "binary_word",
    to: "binary_word",
    body: grayNextBody,
    summary:
      "The next word in the Gray code: flip the first letter when the ones are even in number, else the letter after the first one.",
    note: "FindStat's Mp00272, a bijection. The last word of the code, with its only one last, goes to the zero word.",
  },
  {
    name: "GrayPrevious",
    from: "binary_word",
    to: "binary_word",
    body: grayPreviousBody,
    summary:
      "The previous word in the Gray code: flip the first letter when the ones are odd in number, else the letter after the first one.",
    note: "FindStat's Mp00273, the inverse of GrayNext. The zero word gets its last letter flipped.",
  },
  {
    name: "ValleysToPeaks",
    from: "binary_word",
    to: "binary_word",
    body: valleysToPeaksBody,
    summary: "Every valley 01 swapped for a peak 10, and a trailing 0 made a 1.",
    note: "FindStat's Mp00234. Lossy: 01 and 10 both give 10.",
  },
  {
    name: "Rowmotion",
    from: "binary_word",
    to: "binary_word",
    body: rowmotionBody,
    summary:
      "Rowmotion of the word as an order ideal of a product of two chains: the stretches between valleys reversed, each valley written 10.",
    note: "FindStat's Mp00278. A bijection that keeps the number of ones; its order is the length of the word.",
  },
  {
    name: "PathRowmotion",
    from: "binary_word",
    to: "binary_word",
    body: pathRowmotionBody,
    summary:
      "Rowmotion of the word as a lattice path: the path whose peaks are the original's valleys with an up step appended.",
    note: "FindStat's Mp00280, a bijection. Not Rowmotion: that reads the word as an order ideal.",
  },
  {
    name: "ZerosToFlagZeros",
    from: "binary_word",
    to: "binary_word",
    body: zerosToFlagZerosBody,
    summary: "The word whose reverse complement, prepended, has as many occurrences of 10 as this has zeros.",
    note: "FindStat's Mp00268, the inverse of FlagZerosToZeros.",
  },
  {
    name: "FlagZerosToZeros",
    from: "binary_word",
    to: "binary_word",
    body: flagZerosToZerosBody,
    summary: "The word with as many zeros as this one, prepended with its reverse complement, has occurrences of 10.",
    note: "FindStat's Mp00269, the inverse of ZerosToFlagZeros.",
  },
  {
    name: "FoataMajorToInversions",
    from: "binary_word",
    to: "binary_word",
    body: foataMajorToInversionsBody,
    summary:
      "Foata's bijection on words: each letter is put on the end of the image so far, which is cut into blocks, and every block is rotated one place right.",
    note: "FindStat's Mp00096. With repeated letters an equal letter counts as the smaller, so it is the permutation map through standardization; it sends the major index to the number of inversions.",
  },
  {
    name: "FoataInversionsToMajor",
    from: "binary_word",
    to: "binary_word",
    body: foataInversionsToMajorBody,
    summary: "The inverse of Foata's bijection on words: peel off the last letter, rotate the blocks of the rest back.",
    note: "FindStat's Mp00316.",
  },
  {
    name: "CodeComposition",
    from: "binary_word",
    to: "composition",
    body: codeCompositionBody,
    summary:
      "The composition whose code is the word with a 1 put in front: each 1 opens a part, of 1 plus the zeros after it.",
    note: "FindStat's Mp00178, Sage's from_code. An injection one size up (the empty composition has no preimage); the inverse of CodeWord on the words that start with 1. Not Composition, whose word marks the cuts.",
  },
  {
    name: "SupportDyckPath",
    from: "parking_function",
    to: "dyck_path",
    body: supportDyckPathBody,
    summary: "The Dyck path whose area sequence is j minus the j-th smallest entry: the parking function's support.",
    note: "FindStat's Mp00056, Sage's to_area_sequence. A surjection: the preimage of a path is its parking functions, the labelings of its up steps.",
  },
];
