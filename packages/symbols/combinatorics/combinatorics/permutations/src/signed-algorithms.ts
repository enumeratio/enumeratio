// Combinatorial maps on signed permutations that are procedures: Foata and Han's bijection, the
// Demazure product of a signed permutation with its inverse, and rowmotion in the sorting order.
// Each is an iteration over a list held in the fold's accumulator.

import { bind, forEach, type CombinatorialMap, type MathJSON } from "../../src/map-helpers.ts";

const n: MathJSON = ["Length", "_raw"];
const upTo = (count: MathJSON): MathJSON => ["Range", 1, count, 1];
const lengthOf = (list: MathJSON): MathJSON => ["Length", list];
const entry = (list: MathJSON, index: MathJSON): MathJSON => ["At", list, index];
const typed = "list<integer>";

/** The first `count` entries of `list` (count at least 1). */
const firstOf = (list: MathJSON, count: MathJSON): MathJSON => forEach(upTo(count), entry(list, "q"), "q");

/** `list` with the entries at positions a and a + 1 exchanged. */
const swapped = (list: MathJSON, a: MathJSON): MathJSON =>
  forEach(
    upTo(lengthOf(list)),
    [
      "If",
      ["Equal", "q", a],
      entry(list, ["Add", a, 1]),
      ["If", ["Equal", "q", ["Add", a, 1]], entry(list, a), entry(list, "q")],
    ],
    "q",
  );

/** Two lists end to end, as a fresh list: a `Join` of lazy lists stays lazy, and an accumulator must not. */
const appended = (first: MathJSON, firstLength: MathJSON, second: MathJSON, secondLength: MathJSON): MathJSON =>
  forEach(
    upTo(["Add", firstLength, secondLength]),
    ["If", ["LessEqual", "j", firstLength], entry(first, "j"), entry(second, ["Subtract", "j", firstLength])],
    "j",
  );

// Foata and Han's bijection. Both directions carry the word being built in the fold's accumulator:
// the first k entries are the image so far, the rest is the input yet to be read.

/** Whether letter j of `list` is on the same side of x as its last letter: the letters γ cuts after. */
const closes =
  (list: MathJSON, x: MathJSON) =>
  (j: MathJSON): MathJSON => [
    "If",
    ["LessEqual", entry(list, lengthOf(list)), x],
    ["LessEqual", entry(list, j), x],
    ["Greater", entry(list, j), x],
  ];

/** γ(w, x): cut after each letter on the side of x its last letter is on; move each block's last letter to its front. */
const gamma = (list: MathJSON, x: MathJSON): MathJSON => {
  const cut = closes(list, x);
  return forEach(
    upTo(lengthOf(list)),
    [
      "If",
      ["If", ["Equal", "p", 1], "True", cut(["Max", ["Subtract", "p", 1], 1])],
      entry(list, ["Min", ["Filter", ["Range", "p", lengthOf(list), 1], ["Function", cut("r"), "r"]]]),
      entry(list, ["Max", ["Subtract", "p", 1], 1]),
    ],
    "p",
  );
};

/** δ(w, x): open a block at each letter on the side of x the first letter is on; move each block's first letter to its end. */
const delta = (list: MathJSON, x: MathJSON): MathJSON => {
  const opens = (j: MathJSON): MathJSON => [
    "If",
    ["GreaterEqual", entry(list, 1), x],
    ["GreaterEqual", entry(list, j), x],
    ["Less", entry(list, j), x],
  ];
  const next: MathJSON = ["Min", ["Add", "p", 1], lengthOf(list)];
  return forEach(
    upTo(lengthOf(list)),
    [
      "If",
      ["If", ["Equal", "p", lengthOf(list)], "True", opens(next)],
      entry(list, ["Max", ["Filter", upTo("p"), ["Function", opens("r"), "r"]]]),
      entry(list, next),
    ],
    "p",
  );
};

/** `list` with its first letter negated. */
const negatedFirst = (list: MathJSON): MathJSON =>
  forEach(upTo(lengthOf(list)), ["If", ["Equal", "p", 1], ["Negate", entry(list, 1)], entry(list, "p")], "p");

/** Whether f is in [−x, x] or in (x, −x): the test that decides whether the first letter is negated. */
const withinReach = (f: MathJSON, x: MathJSON): MathJSON => [
  "Or",
  ["And", ["LessEqual", ["Negate", x], f], ["LessEqual", f, x]],
  ["And", ["Less", x, f], ["Less", f, ["Negate", x]]],
];

/** The accumulator with its first `count` entries replaced by `image`. */
const withPrefix = (acc: MathJSON, count: MathJSON, image: MathJSON): MathJSON =>
  forEach(upTo(n), ["If", ["Less", "j", count], entry(image, "j"), entry(acc, "j")], "j");

/** Reading the word left to right: the image of the letters so far goes through β with the next letter x. */
const foataHanBody: MathJSON = [
  "If",
  ["Less", n, 2],
  "_raw",
  [
    "Fold",
    [
      "Function",
      bind(
        "fh_x",
        entry("fh_acc", "fh_k"),
        bind(
          "fh_u",
          firstOf("fh_acc", ["Subtract", "fh_k", 1]),
          bind(
            "fh_g",
            gamma("fh_u", "fh_x"),
            bind(
              "fh_f",
              entry("fh_u", [
                "Min",
                ["Filter", upTo(lengthOf("fh_u")), ["Function", closes("fh_u", "fh_x")("r"), "r"]],
              ]),
              bind(
                "fh_h",
                ["If", withinReach("fh_f", "fh_x"), "fh_g", negatedFirst("fh_g")],
                bind("fh_v", delta("fh_h", ["Negate", "fh_x"]), withPrefix("fh_acc", "fh_k", "fh_v"), typed),
                typed,
              ),
              "integer",
            ),
            typed,
          ),
          typed,
        ),
        "integer",
      ),
      "fh_acc",
      "fh_k",
    ],
    "_raw",
    ["Range", 2, n, 1],
  ],
];

/** Reading from the last letter: peel x off, undo β on the rest, and leave x in place. */
const inverseFoataHanBody: MathJSON = [
  "If",
  ["Less", n, 2],
  "_raw",
  [
    "Fold",
    [
      "Function",
      bind(
        "fi_k",
        ["Subtract", ["Add", n, 1], "fi_t"],
        bind(
          "fi_x",
          entry("fi_acc", "fi_k"),
          bind(
            "fi_v",
            gamma(firstOf("fi_acc", ["Subtract", "fi_k", 1]), ["Subtract", ["Negate", "fi_x"], 1]),
            bind(
              "fi_h",
              ["If", withinReach(entry("fi_v", 1), "fi_x"), "fi_v", negatedFirst("fi_v")],
              bind("fi_r", delta("fi_h", ["Add", "fi_x", 1]), withPrefix("fi_acc", "fi_k", "fi_r"), typed),
              typed,
            ),
            typed,
          ),
          "integer",
        ),
        "integer",
      ),
      "fi_acc",
      "fi_t",
    ],
    "_raw",
    ["Range", 1, ["Subtract", n, 1], 1],
  ],
];

// The Demazure product, by the 2n-point word of the signed permutation: entry p is ±i read in the order
// 1 < … < n < −n < … < −1, entry 2n + 1 − p is its negative. In that word the product of w with its
// inverse is a bubble sort of a second copy of the word that exchanges the first copy's entries only
// when that lengthens it.

const twoN: MathJSON = ["Multiply", 2, n];
const top: MathJSON = ["Add", twoN, 1];
/** The rank of a signed entry in the order 1 < … < n < −n < … < −1. */
const rankOf = (value: MathJSON): MathJSON => ["If", ["Greater", value, 0], value, ["Add", top, value]];

/** One step: exchange the first descent of the second copy, and the same positions of the first when that lengthens it. */
const demazureStep: MathJSON = bind(
  "dz_sorted",
  firstOf("dz_acc", twoN),
  bind(
    "dz_word",
    forEach(upTo(twoN), entry("dz_acc", ["Add", "q", twoN]), "q"),
    bind(
      "dz_a",
      [
        "Min",
        [
          "Join",
          [
            "Filter",
            upTo(["Subtract", twoN, 1]),
            ["Function", ["Greater", entry("dz_word", "r"), entry("dz_word", ["Add", "r", 1])], "r"],
          ],
          ["List", twoN],
        ],
      ],
      [
        "If",
        ["Equal", "dz_a", twoN],
        "dz_acc",
        bind(
          "dz_first",
          [
            "If",
            ["Less", entry("dz_sorted", "dz_a"), entry("dz_sorted", ["Add", "dz_a", 1])],
            swapped("dz_sorted", "dz_a"),
            "dz_sorted",
          ],
          bind("dz_second", swapped("dz_word", "dz_a"), appended("dz_first", twoN, "dz_second", twoN), typed),
          typed,
        ),
      ],
      "integer",
    ),
    typed,
  ),
  typed,
);

const demazureBody: MathJSON = [
  "If",
  ["Less", n, 1],
  "_raw",
  bind(
    "dz_key",
    forEach(
      upTo(twoN),
      [
        "If",
        ["LessEqual", "p", n],
        rankOf(entry("_raw", ["Min", "p", n])),
        ["Subtract", top, rankOf(entry("_raw", ["Max", ["Subtract", top, "p"], 1]))],
      ],
      "p",
    ),
    bind(
      "dz_done",
      [
        "Fold",
        ["Function", demazureStep, ["Typed", "dz_acc", "'list<integer>'"], "dz_step"],
        appended("dz_key", twoN, "dz_key", twoN),
        upTo(["Multiply", n, ["Subtract", twoN, 1]]),
      ],
      forEach(upTo(n), [
        "If",
        ["LessEqual", entry("dz_done", "i"), n],
        entry("dz_done", "i"),
        ["Subtract", entry("dz_done", "i"), top],
      ]),
      typed,
    ),
    typed,
  ),
];

// Rowmotion in the sorting order, through the signed Lehmer code: the cocode of the standardization
// (each entry plus one, modulo its position) and the signs by value, which rowmotion rewrites as a binary word.

const positionsOf: MathJSON = upTo(n);
const ones = (count: MathJSON): MathJSON => forEach(upTo(count), 1, "q");
/** `count` zeros, none for 0 (a Range counts down when its end is below its start). */
const zeros = (count: MathJSON): MathJSON =>
  forEach(["Filter", upTo(["Add", count, 1]), ["Function", ["LessEqual", "q", count], "q"]], 0, "q");

/** The free ones before position i: those since the last zero that closes a valley (a zero before a one, or the last letter) that are not the 1 of a valley. */
const freeOnesBefore = (signs: MathJSON): MathJSON => {
  const sign = (j: MathJSON): MathJSON => entry(signs, j);
  const valleyAt = (v: MathJSON): MathJSON => [
    "And",
    ["Equal", sign(v), 0],
    ["Or", ["Equal", v, n], ["Equal", sign(["Min", ["Add", v, 1], n]), 1]],
  ];
  return forEach(upTo(["Add", n, 1]), [
    "Count",
    [
      "Filter",
      positionsOf,
      [
        "Function",
        [
          "And",
          ["Less", "j", "i"],
          ["Equal", sign("j"), 1],
          ["Or", ["Equal", "j", 1], ["Equal", sign(["Max", ["Subtract", "j", 1], 1]), 1]],
          [
            "Greater",
            "j",
            [
              "Max",
              [
                "Join",
                ["List", 0],
                ["Filter", positionsOf, ["Function", ["And", ["Less", "v", "i"], valleyAt("v")], "v"]],
              ],
            ],
          ],
        ],
        "j",
      ],
    ],
  ]);
};

/** The signs word after rowmotion: a zero followed by a one writes the ones counted so far, then a zero. */
const rowmotionOfSigns = (signs: MathJSON, free: MathJSON): MathJSON => [
  "Join",
  [
    "Flatten",
    forEach(positionsOf, [
      "If",
      ["Equal", entry(signs, "i"), 1],
      ["List"],
      [
        "If",
        ["Equal", "i", n],
        ones(["Add", entry(free, "i"), 1]),
        [
          "If",
          ["Equal", entry(signs, ["Add", "i", 1]), 1],
          ["Join", ones(["Add", entry(free, "i"), 1]), ["List", 0]],
          ["List", 0],
        ],
      ],
    ]),
  ],
  zeros(entry(free, ["Add", n, 1])),
];

/** The permutation whose cocode is `code`: from the last position, the entry with `code` larger ones before it. */
const permutationOfCocode = (code: MathJSON): MathJSON => [
  "Fold",
  [
    "Function",
    [
      "Join",
      [
        "List",
        entry(
          [
            "Sort",
            [
              "Filter",
              positionsOf,
              ["Function", ["Equal", ["Count", ["Filter", "rm_acc", ["Function", ["Equal", "a", "v"], "a"]]], 0], "v"],
            ],
          ],
          ["Subtract", ["Subtract", ["Add", n, 1], "rm_t"], entry(code, ["Subtract", ["Add", n, 1], "rm_t"])],
        ),
      ],
      "rm_acc",
    ],
    "rm_acc",
    "rm_t",
  ],
  ["List"],
  positionsOf,
];

const rowmotionBody: MathJSON = bind(
  "rm_rank",
  forEach(positionsOf, rankOf(entry("_raw", "i"))),
  bind(
    "rm_std",
    forEach(positionsOf, [
      "Count",
      ["Filter", positionsOf, ["Function", ["LessEqual", entry("rm_rank", "j"), entry("rm_rank", "i")], "j"]],
    ]),
    bind(
      "rm_code",
      forEach(positionsOf, [
        "Mod",
        [
          "Add",
          1,
          [
            "Count",
            [
              "Filter",
              positionsOf,
              ["Function", ["And", ["Less", "j", "i"], ["Greater", entry("rm_std", "j"), entry("rm_std", "i")]], "j"],
            ],
          ],
        ],
        "i",
      ]),
      bind(
        "rm_sigma",
        permutationOfCocode("rm_code"),
        bind(
          "rm_signs",
          forEach(positionsOf, [
            "If",
            ["Equal", ["Count", ["Filter", "_raw", ["Function", ["Equal", "x", ["Negate", "i"]], "x"]]], 1],
            1,
            0,
          ]),
          bind(
            "rm_free",
            freeOnesBefore("rm_signs"),
            bind(
              "rm_next",
              rowmotionOfSigns("rm_signs", "rm_free"),
              bind(
                "rm_entries",
                [
                  "Join",
                  ["Filter", positionsOf, ["Function", ["Equal", entry("rm_next", "v"), 0], "v"]],
                  forEach(
                    [
                      "Filter",
                      forEach(positionsOf, ["Subtract", ["Add", n, 1], "i"]),
                      ["Function", ["Equal", entry("rm_next", "v"), 1], "v"],
                    ],
                    ["Negate", "i"],
                  ),
                ],
                forEach(positionsOf, entry("rm_entries", entry("rm_sigma", "i"))),
                typed,
              ),
              typed,
            ),
            typed,
          ),
          typed,
        ),
        typed,
      ),
      typed,
    ),
    typed,
  ),
  typed,
);

export const SIGNED_PERMUTATIONS_ALGORITHM_MAPS: readonly CombinatorialMap[] = [
  {
    name: "FoataHan",
    from: "signed_permutation",
    to: "signed_permutation",
    body: foataHanBody,
    summary:
      "Foata and Han's fundamental transformation: each letter in turn is put on the end of the image so far, which is cut into blocks and rotated.",
    note: "FindStat's Mp00190, a bijection that sends the flag major index to the flag inversion number. Inverse: InverseFoataHan.",
  },
  {
    name: "InverseFoataHan",
    from: "signed_permutation",
    to: "signed_permutation",
    body: inverseFoataHanBody,
    summary:
      "The inverse of Foata and Han's transformation: the last letter is peeled off and the blocks of the rest are rotated back.",
    note: "FindStat's Mp00194, sending the flag inversion number to the flag major index.",
  },
  {
    name: "DemazureProductWithInverse",
    from: "signed_permutation",
    to: "signed_permutation",
    body: demazureBody,
    summary: "The Demazure product π⁻¹ ⋆ π in the hyperoctahedral group.",
    note: "FindStat's Mp00260: π⁻¹ ⋆ π, the inverse on the left. Not injective: it is a surjection onto the involutions. The group is generated by the adjacent transpositions and the sign change of the largest value.",
  },
  {
    name: "Rowmotion",
    from: "signed_permutation",
    to: "signed_permutation",
    body: rowmotionBody,
    summary: "Rowmotion of the signed permutation with respect to the sorting order, through its signed Lehmer code.",
    note: "FindStat's Mp00281, a bijection. The sorting order is Armstrong's, for the Coxeter element −n, 1, …, n − 1.",
  },
];
