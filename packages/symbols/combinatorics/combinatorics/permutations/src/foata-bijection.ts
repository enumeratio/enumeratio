// Foata's bijection from the major index to the number of inversions (FindStat's Mp00067, Mp00175), as
// the inductive block construction: each new letter x goes on the end of the image so far, which is cut
// into blocks, and every block is rotated one place right. The final block is always x alone, so the image of
// a prefix is the first part of the image of the whole, and the inverse peels one letter off the end at a time.
import { at, bind, forEach, type MathJSON } from "../../src/map-helpers.ts";

const upTo = (n: MathJSON): MathJSON => ["Range", 1, n, 1];

/** Mp00067: the block ends after each letter of the image so far that `x` compares with as the last letter does
 *  (at most `x` when `x` is at least the last letter, above `x` otherwise); each block is rotated right. */
export const foataMajorToInversionsBody: MathJSON = [
  "If",
  ["Equal", ["Length", "_raw"], 0],
  ["List"],
  [
    "Fold",
    [
      "Function",
      bind(
        "x",
        at("j"),
        bind(
          "word",
          ["Join", "acc", ["List", "x"]],
          bind(
            "size",
            ["Length", "word"],
            // Whether a block ends after position k: k is at most the last letter's counterpart for x.
            bind(
              "ends",
              forEach(
                upTo("size"),
                [
                  "Or",
                  ["Equal", "k", "size"],
                  [
                    "If",
                    ["GreaterEqual", "x", at(["Subtract", "size", 1], "word")],
                    ["GreaterEqual", "x", at("k", "word")],
                    ["Less", "x", at("k", "word")],
                  ],
                ],
                "k",
              ),
              forEach(
                upTo("size"),
                [
                  "If",
                  ["Or", ["Equal", "p", 1], at(["Subtract", "p", 1], "ends")],
                  // The first place of a block takes the block's last letter.
                  at(["Min", forEach(["Range", "p", "size", 1], ["If", at("q", "ends"), "q", "size"], "q")], "word"),
                  at(["Subtract", "p", 1], "word"),
                ],
                "p",
              ),
              "list<boolean>",
            ),
            "integer",
          ),
          "list<integer>",
        ),
      ),
      "acc",
      "j",
    ],
    ["List", at(1)],
    ["Range", 2, ["Length", "_raw"], 1],
  ],
];

/** Mp00175: peel the last letter x off, find the blocks of the rest (each starts with a letter at most x when the
 *  first letter is, above x otherwise), rotate each block back left, and go on with what is left. */
export const foataInversionsToMajorBody: MathJSON = [
  "If",
  ["Equal", ["Length", "_raw"], 0],
  ["List"],
  bind(
    "state",
    [
      "Fold",
      [
        "Function",
        bind(
          "word",
          at(1, "acc"),
          bind(
            "tail",
            at(2, "acc"),
            bind(
              "x",
              at("j", "word"),
              bind(
                "rest",
                forEach(upTo(["Subtract", "j", 1]), at("k", "word"), "k"),
                bind(
                  "starts",
                  forEach(
                    upTo(["Subtract", "j", 1]),
                    [
                      "If",
                      ["LessEqual", at(1, "rest"), "x"],
                      ["LessEqual", at("k", "rest"), "x"],
                      ["Greater", at("k", "rest"), "x"],
                    ],
                    "k",
                  ),
                  [
                    "List",
                    forEach(
                      upTo(["Subtract", "j", 1]),
                      [
                        "If",
                        ["Or", ["Equal", "p", ["Subtract", "j", 1]], at(["Add", "p", 1], "starts")],
                        at(["Max", forEach(upTo("p"), ["If", at("q", "starts"), "q", 1], "q")], "rest"),
                        at(["Add", "p", 1], "rest"),
                      ],
                      "p",
                    ),
                    ["Join", ["List", "x"], "tail"],
                  ],
                  "list<boolean>",
                ),
                "list<integer>",
              ),
              "integer",
            ),
            "list<integer>",
          ),
          "list<integer>",
        ),
        "acc",
        "j",
      ],
      ["List", "_raw", ["List"]],
      ["Range", ["Length", "_raw"], 2, -1],
    ],
    ["Join", at(1, "state"), at(2, "state")],
    "list<any>",
  ),
];
