// Combinatorial maps whose `from` carrier is `signed_permutation`: a word of 1..n, each entry
// with a sign (the one-line notation of the hyperoctahedral group).

import {
  at,
  bind,
  descending,
  forEach,
  type CombinatorialMap,
  type MathJSON,
  positions,
} from "../../src/map-helpers.ts";

const n: MathJSON = ["Length", "_raw"];
const abs = (i: MathJSON = "i"): MathJSON => ["Abs", at(i)];

/** The contents of a carrier value `word` (a binary word): `At` doesn't see through the
 *  constructor, but a lambda argument does. */
const contentsOf = (word: MathJSON): MathJSON => ["Apply", ["Function", ["At", "bw", 1], "bw"], word];

/** Each entry of `_raw` given the sign `sign(i)` (1 positive, 0 negative) and keeping its size. */
const withSigns = (signs: MathJSON): MathJSON =>
  forEach(positions, ["If", ["Equal", at("i", signs), 1], abs(), ["Negate", abs()]]);

/** The binary word of signs, 1 for a positive entry. */
const positiveWord: MathJSON = ["BinaryWord", forEach(positions, ["If", ["Greater", at("i"), 0], 1, 0])];

/** The cycle of the underlying permutation through i: the positions i reaches. */
const orbit = (start: MathJSON): MathJSON => [
  "Union",
  forEach(positions, ["Fold", ["Function", ["Abs", ["At", "_raw", "a"]], "a", "b"], start, ["Range", 1, "k", 1]], "k"),
];

/** The lengths, largest first, of the cycles with an even (`parity` 0) or odd (1) number of negative entries. */
const cycleLengthsOfParity = (parity: number): MathJSON =>
  descending(
    forEach(
      [
        "Filter",
        positions,
        [
          "Function",
          bind(
            "orb",
            orbit("c"),
            [
              "And",
              ["Equal", "c", ["Min", "orb"]],
              ["Equal", ["Mod", ["Count", ["Filter", "orb", ["Function", ["Less", at("o"), 0], "o"]]], 2], parity],
            ],
            "set<integer>",
          ),
          "c",
        ],
      ],
      bind("orb", orbit("c"), ["Length", "orb"], "set<integer>"),
      "c",
    ),
  );

export const SIGNED_PERMUTATIONS_MAPS: readonly CombinatorialMap[] = [
  {
    name: "Reverse",
    from: "signed_permutation",
    to: "signed_permutation",
    body: forEach(positions, at(["Subtract", ["Add", n, 1], "i"])),
    summary: "The word read backwards, signs kept.",
    note: "FindStat's Mp00161.",
  },
  {
    name: "Complement",
    from: "signed_permutation",
    to: "signed_permutation",
    body: forEach(positions, ["Multiply", ["Sign", at("i")], ["Subtract", ["Add", n, 1], abs()]]),
    summary: "Each entry ±i replaced by ±(n + 1 − i), its sign kept.",
    note: "FindStat's Mp00188.",
  },
  {
    name: "Inverse",
    from: "signed_permutation",
    to: "signed_permutation",
    // The entry at the position j of the signed permutation that sends j to ±i: i carries the sign of that entry.
    body: forEach(positions, [
      "Multiply",
      ["Sign", at(["IndexWhere", "_raw", ["Function", ["Equal", ["Abs", "x"], "i"], "x"]])],
      ["IndexWhere", "_raw", ["Function", ["Equal", ["Abs", "x"], "i"], "x"]],
    ]),
    summary: "The inverse signed permutation: ±j goes to the position of j, signed as the entry there.",
    note: "FindStat's Mp00162.",
  },
  {
    name: "NegateSigns",
    from: "signed_permutation",
    to: "signed_permutation",
    body: forEach(positions, ["Negate", at("i")]),
    summary: "Every sign reversed: multiplication by the longest element −id of the hyperoctahedral group.",
    note: 'FindStat\'s Mp00244, "bar".',
  },
  {
    name: "SignWord",
    from: "signed_permutation",
    to: "binary_word",
    body: forEach(positions, ["If", ["Greater", at("i"), 0], 0, 1]),
    summary: "The signs as a binary word: letter i is 1 when entry i is negative.",
    note: "FindStat's Mp00267. Lossy: the absolute values are forgotten.",
  },
  {
    name: "UnderlyingPermutation",
    from: "signed_permutation",
    to: "permutation",
    body: forEach(positions, abs()),
    summary: "The permutation left when the signs are forgotten.",
    note: "FindStat's Mp00163. Lossy: the signs are forgotten, so it is not a constructor overload.",
  },
  {
    name: "SignedPermutation",
    convert: true,
    from: "permutation",
    to: "signed_permutation",
    body: "_raw",
    summary: "A permutation as the signed permutation with every sign positive.",
    note: "FindStat's Mp00170.",
    findstat: ["Mp00170"],
  },
  {
    name: "Standardization",
    from: "signed_permutation",
    to: "permutation",
    // In the order 1 < … < n < −n < … < −1, an entry −i has key 2n + 1 − i.
    body: bind(
      "sg_key",
      forEach(positions, ["If", ["Greater", at("i"), 0], at("i"), ["Add", ["Multiply", 2, n], 1, at("i")]]),
      forEach(positions, [
        "Count",
        ["Filter", positions, ["Function", ["LessEqual", at("j", "sg_key"), at("i", "sg_key")], "j"]],
      ]),
      "list<integer>",
    ),
    summary: "The permutation of the same relative order, taking 1 < … < n < −n < … < −1.",
    note: "FindStat's Mp00245.",
  },
  {
    name: "NegativesToFlagNegatives",
    from: "signed_permutation",
    to: "signed_permutation",
    // The underlying permutation stays; ZerosToFlagZeros acts on the signs, a positive entry being a 1.
    body: withSigns(contentsOf(["ZerosToFlagZeros", positiveWord])),
    summary: "The signs rearranged so the flag negatives of the image count the negatives of the original.",
    note: "FindStat's Mp00270: ZerosToFlagZeros on the sign word, the underlying permutation kept.",
  },
  {
    name: "FlagNegativesToNegatives",
    from: "signed_permutation",
    to: "signed_permutation",
    body: withSigns(contentsOf(["FlagZerosToZeros", positiveWord])),
    summary: "The signs rearranged so the negatives of the image count the flag negatives of the original.",
    note: "FindStat's Mp00271, the inverse of NegativesToFlagNegatives.",
  },
  {
    name: "PositiveCycleType",
    from: "signed_permutation",
    to: "integer_partition",
    body: cycleLengthsOfParity(0),
    summary:
      "The lengths of the positive cycles, largest first: those of the underlying permutation with an even number of negative entries.",
    note: "FindStat's Mp00166, \"even cycle type\". Geck and Pfeiffer's positive cycles.",
  },
  {
    name: "NegativeCycleType",
    from: "signed_permutation",
    to: "integer_partition",
    body: cycleLengthsOfParity(1),
    summary:
      "The lengths of the negative cycles, largest first: those of the underlying permutation with an odd number of negative entries.",
    note: "FindStat's Mp00169, \"odd cycle type\". Geck and Pfeiffer's negative cycles.",
  },
];
