// Epsil bodies for the maps that go through a permutation's Lehmer code or major code: both
// encode a permutation of n as a sequence (c_1 .. c_n) with 0 <= c_i <= n - i, and a code
// decodes back by choosing, entry by entry, what the code says to.

import { at, bind, forEach, type MathJSON } from "../../src/map-helpers.ts";

/** The indices 1 .. n, none when n is 0: the stated step keeps the range from counting down. */
const upTo = (n: MathJSON): MathJSON => ["Range", 1, n, 1];

/** Entry i counts the later entries smaller than entry i. */
export const lehmerCode: MathJSON = forEach(upTo(["Length", "_raw"]), [
  "Count",
  [
    "Filter",
    upTo(["Length", "_raw"]),
    ["Function", ["And", ["Greater", "j", "i"], ["Greater", at("i"), at("j")]], "j"],
  ],
]);

/** The permutation whose Lehmer code is `code` (a list of n entries, entry i at most n - i):
 *  entry i is the (code_i + 1)-th smallest of the values not yet used. */
export const permutationOfLehmerCode = (code: MathJSON): MathJSON =>
  bind(
    "code",
    code,
    [
      "Fold",
      [
        "Function",
        [
          "Join",
          "acc",
          [
            "List",
            [
              "At",
              ["Sort", ["Filter", upTo(["Length", "code"]), ["Function", ["Not", ["Element", "v", "acc"]], "v"]]],
              ["Add", at("i", "code"), 1],
            ],
          ],
        ],
        "acc",
        "i",
      ],
      ["List"],
      upTo(["Length", "code"]),
    ],
    "list<integer>",
  );

/** The major index of `word`: the sum of the positions where it falls. */
const majorIndexOf = (word: MathJSON): MathJSON => [
  "Fold",
  ["Function", ["If", ["Greater", at("d", word), at(["Add", "d", 1], word)], ["Add", "acc", "d"], "acc"], "acc", "d"],
  0,
  upTo(["Subtract", ["Length", word], 1]),
];

/** The word's entries that are at least `floor`, in order: the permutation with the smaller values deleted. */
const deleted = (floor: MathJSON): MathJSON => [
  "Filter",
  upTo(["Length", "_raw"]),
  ["Function", ["GreaterEqual", at("e"), floor], "e"],
];

/** The major index of the word with every value below `floor` deleted. */
const majorIndexAbove = (floor: MathJSON): MathJSON =>
  bind("del", forEach(deleted(floor), at("e"), "e"), majorIndexOf("del"), "list<integer>");

/** Entry i of the major code is the major index gained by putting value i back: maj(del_i) - maj(del_{i+1}). */
export const majorCode: MathJSON = forEach(upTo(["Length", "_raw"]), [
  "Subtract",
  majorIndexAbove("i"),
  majorIndexAbove(["Add", "i", 1]),
]);

/** The permutation whose major code is `code`: put the values back from n down to 1, each smallest so
 *  far, at the one slot of the word built so far where it adds exactly code_i to the major index.
 *  Putting the smallest value after s entries of a word keeps the descents before the slot, adds one at
 *  slot s (the entry before it is larger) and moves the later ones up a place; the descent the slot
 *  sat on is the one replaced, so the gain is s unless the word fell at s, plus the later descents. */
export const permutationOfMajorCode = (code: MathJSON): MathJSON =>
  bind(
    "code",
    code,
    [
      "Fold",
      [
        "Function",
        bind(
          "gain",
          // The slot s of acc whose gain is code_i; slot 0 for the first value into an empty word.
          [
            "If",
            ["Equal", ["Length", "acc"], 0],
            0,
            [
              "First",
              [
                "Filter",
                ["Range", 0, ["Length", "acc"], 1],
                [
                  "Function",
                  [
                    "Equal",
                    [
                      "Add",
                      [
                        "Multiply",
                        "s",
                        [
                          "Subtract",
                          1,
                          [
                            "If",
                            ["And", ["Greater", "s", 0], ["Less", "s", ["Length", "acc"]]],
                            [
                              "If",
                              [
                                "Greater",
                                at(["Max", "s", 1], "acc"),
                                at(["Min", ["Add", "s", 1], ["Length", "acc"]], "acc"),
                              ],
                              1,
                              0,
                            ],
                            0,
                          ],
                        ],
                      ],
                      [
                        "Count",
                        [
                          "Filter",
                          upTo(["Subtract", ["Length", "acc"], 1]),
                          [
                            "Function",
                            ["And", ["Greater", "d", "s"], ["Greater", at("d", "acc"), at(["Add", "d", 1], "acc")]],
                            "d",
                          ],
                        ],
                      ],
                    ],
                    at("i", "code"),
                  ],
                  "s",
                ],
              ],
            ],
          ],
          forEach(
            upTo(["Add", ["Length", "acc"], 1]),
            [
              "If",
              ["Less", "t", ["Add", "gain", 1]],
              at("t", "acc"),
              ["If", ["Equal", "t", ["Add", "gain", 1]], "i", at(["Subtract", "t", 1], "acc")],
            ],
            "t",
          ),
        ),
        "acc",
        "i",
      ],
      ["List"],
      ["Range", ["Length", "code"], 1, -1],
    ],
    "list<integer>",
  );
