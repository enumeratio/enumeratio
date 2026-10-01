// Surjections, SetPartitions, SetPartitionsIntoKBlocks, SetCompositions and PerfectMatchings
// split out of collections/src/families/core.ts (which mixed every area) per
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 5. PerfectMatchings, colocated with SetPartitions in core.ts's "set partitions /
// matchings" section, now carries "SetPartition" too: its "blocks" shape (a matching's pairs)
// is exactly SetPartition's shape (list<list<integer>>), so it is wired as a RESTRICTION of
// SetPartition rather than the "PerfectMatching" carrier (whose shape, list<integer>, is a
// different encoding this family's kernel never produces) -- resolving the wiki's open
// question 1.
//
// Surjections, SetPartitions and SetPartitionsIntoKBlocks are defined in Epsil, each ranked
// through a table of completions; their TS kernels in collections/src/families/kernels*.ts stay
// as the independent reading the agreement tests check against.
import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import {
  PerfectMatchingCount,
  PerfectMatchingUnrank,
  PerfectMatchingRank,
  IsPerfectMatchingOf,
} from "../../../collections/src/families/kernels-extra.ts";
import {
  IsSetPartitionOf,
  Fubini,
  SetCompositionUnrank,
  SetCompositionRank,
  LabelsToOrderedBlocks,
  BlocksToLabels,
} from "../../../collections/src/families/kernels-combinatorics.ts";
import {
  add,
  all,
  and,
  at,
  cell,
  equal,
  fold,
  iff,
  len,
  less,
  lets,
  map,
  mul,
  quotient,
  rowTable,
  sub,
  upTo,
  withTable,
} from "../../../collections/src/families/tables.ts";
import type { NumberKernel } from "../../../collections/src/families/types.ts";

type MathJSON = unknown;

const contains = (list: MathJSON, x: MathJSON): MathJSON => ["Contains", list, x];

// ─── SetPartitions(n) and SetPartitionsIntoKBlocks(n, k), as restricted growth strings ───
// An RGS labels each of 1..n with its block, a new block taking the next label, in lex order.
// T(rem, open), the ways to label the last rem positions with `open` blocks already open, is
// open·T(rem − 1, open) (an open block) + T(rem − 1, open + 1) (a new one, while fewer than `cap`
// are open); T(0, open) is `last(open)`: 1 for SetPartitions, [open = k] for k blocks.

const rgsTable = (cap: MathJSON, last: (open: string) => MathJSON): MathJSON =>
  rowTable("b", add("_n", 1), add(cap, 1), last, (prev, rem, open) =>
    add(mul(open, prev(sub(rem, 1), open)), iff(less(open, cap), prev(sub(rem, 1), add(open, 1)), 0)),
  );

/** Blocks from an RGS over 0..blocks − 1: block j holds the positions labelled j. */
const blocksOf = (rgs: MathJSON, blocks: MathJSON): MathJSON =>
  map(["Filter", upTo(1, "_n"), ["Function", equal(at(rgs, "p"), "j"), "p"]], "j", upTo(0, sub(blocks, 1)));

/** The canonical RGS of a member: x's label is how many blocks start before its block does. */
const rgsOfBlocks: MathJSON = lets(
  [["mins", map(["Min", "blk"], "blk", "_x"), "list<integer>"]],
  map(
    fold(
      iff(
        contains(at("_x", "j"), "x"),
        ["Count", ["Filter", "mins", ["Function", less("z", at("mins", "j")), "z"]]],
        "lbl",
      ),
      "lbl",
      "j",
      0,
      upTo(1, len),
    ),
    "x",
    upTo(1, "_n"),
  ),
);

/** Nonempty blocks covering 1..n once each, in any order. */
const coversOnce: MathJSON = lets(
  [["flat", ["Flatten", "_x"], "list<integer>"]],
  and(
    equal(["Length", "flat"], "_n"),
    all((b) => ["GreaterEqual", ["Length", b], 1], "_x", "blk"),
    all((x) => contains("flat", x), upTo(1, "_n"), "x"),
  ),
);

function setPartitions(
  head: string,
  params: readonly string[],
  cap: MathJSON,
  last: (open: string) => MathJSON,
): EpsilFamily {
  const T = cell("rgs", add(cap, 1));
  const withRgs = (body: MathJSON): MathJSON => withTable("rgs", rgsTable(cap, last), body);
  // A label below `open` names an open block, T(rem, open) completions each; `open` itself
  // opens the next block. The state is [r, open, labels…].
  const unrankStep = lets(
    [
      ["ur", at("us", 1), "integer"],
      ["uo", at("us", 2), "integer"],
      ["ua", T(sub("_n", "ui"), "uo"), "integer"],
    ],
    iff(
      less("ur", mul("uo", "ua")),
      ["Join", ["List", ["Mod", "ur", "ua"], "uo"], ["Drop", "us", 2], ["List", quotient("ur", "ua")]],
      ["Join", ["List", sub("ur", mul("uo", "ua")), add("uo", 1)], ["Drop", "us", 2], ["List", "uo"]],
    ),
  );
  // A fold over the labels themselves, the state [r, open, position].
  const rankStep = lets(
    [
      ["rr", at("rs", 1), "integer"],
      ["ro", at("rs", 2), "integer"],
      ["ra", T(sub("_n", at("rs", 3)), "ro"), "integer"],
    ],
    iff(
      less("rv", "ro"),
      ["List", add("rr", mul("rv", "ra")), "ro", add(at("rs", 3), 1)],
      ["List", add("rr", mul("ro", "ra")), add("ro", 1), add(at("rs", 3), 1)],
    ),
  );
  return {
    head,
    carrier: "SetPartition",
    paramCount: params.length as 1 | 2,
    kind: "blocks",
    params,
    epsil: {
      count: withRgs(T("_n", 0)),
      unrank: withRgs(
        lets(
          [["uend", fold(unrankStep, "us", "ui", ["List", "_r", 0], upTo(1, "_n")), "list<integer>"]],
          blocksOf(["Drop", "uend", 2], at("uend", 2)),
        ),
      ),
      rank: withRgs(
        lets([["rgs0", rgsOfBlocks, "list<integer>"]], at(fold(rankStep, "rs", "rv", ["List", 0, 0, 1], "rgs0"), 1)),
      ),
      valid: params.length === 1 ? coversOnce : and(equal(len, "_k"), coversOnce),
    },
  };
}

const setPartitionsFamily = setPartitions("SetPartitions", ["_n"], "_n", () => 1);
const kBlocks = setPartitions("SetPartitionsIntoKBlocks", ["_n", "_k"], "_k", (open) => iff(equal(open, "_k"), 1, 0));

// ─── Surjections(n, k): words over 1..k using every letter, in lex order ───
// T(rem, missing), the ways to finish rem letters with `missing` letters still unused, is
// missing·T(rem − 1, missing − 1) (a new letter) + (k − missing)·T(rem − 1, missing) (a used one).
const surjectionTable = rowTable(
  "j",
  add("_n", 1),
  add("_k", 1),
  (missing) => iff(equal(missing, 0), 1, 0),
  (prev, rem, missing) =>
    add(
      iff(less(0, missing), mul(missing, prev(sub(rem, 1), sub(missing, 1))), 0),
      mul(sub("_k", missing), prev(sub(rem, 1), missing)),
    ),
);
const S = cell("surj", add("_k", 1));
const withSurjections = (body: MathJSON): MathJSON => withTable("surj", surjectionTable, body);
/** The completions after letter c, `used` the letters before it and rem left after it. */
const afterLetter = (used: MathJSON, rem: MathJSON, missing: MathJSON, c: MathJSON): MathJSON =>
  iff(contains(used, c), S(rem, missing), iff(less(0, missing), S(rem, sub(missing, 1)), 0));

// The state is [r, missing, letters…]; each step searches the letters in order, its own state
// [r, letter, missing] once it has one.
const surjectionUnrankStep = lets(
  [
    ["sw", ["Drop", "su", 2], "list<integer>"],
    ["sm", at("su", 2), "integer"],
    ["sl", sub("_n", "si"), "integer"],
  ],
  lets(
    [
      [
        "sc",
        fold(
          iff(
            less(0, at("sf", 2)),
            "sf",
            lets(
              [["sn", afterLetter("sw", "sl", "sm", "c"), "integer"]],
              iff(
                less(at("sf", 1), "sn"),
                ["List", at("sf", 1), "c", iff(contains("sw", "c"), "sm", sub("sm", 1))],
                ["List", sub(at("sf", 1), "sn"), 0, "sm"],
              ),
            ),
          ),
          "sf",
          "c",
          ["List", at("su", 1), 0, "sm"],
          upTo(1, "_k"),
        ),
        "list<integer>",
      ],
    ],
    ["Join", ["List", at("sc", 1), at("sc", 3)], "sw", ["List", at("sc", 2)]],
  ),
);
// A fold over the word itself, the state [r, missing, position].
const surjectionRankStep = lets(
  [
    ["sp", ["Take", "_x", sub(at("sr", 3), 1)], "list<integer>"],
    ["sm", at("sr", 2), "integer"],
    ["sl", sub("_n", at("sr", 3)), "integer"],
  ],
  [
    "List",
    add(at("sr", 1), fold(add("sb", afterLetter("sp", "sl", "sm", "c")), "sb", "c", 0, upTo(1, sub("sx", 1)))),
    iff(contains("sp", "sx"), "sm", sub("sm", 1)),
    add(at("sr", 3), 1),
  ],
);

const surjections: EpsilFamily = {
  head: "Surjections",
  carrier: "Surjection",
  paramCount: 2,
  kind: "ints",
  params: ["_n", "_k"],
  epsil: {
    count: withSurjections(S("_n", "_k")),
    unrank: withSurjections(["Drop", fold(surjectionUnrankStep, "su", "si", ["List", "_r", "_k"], upTo(1, "_n")), 2]),
    rank: withSurjections(at(fold(surjectionRankStep, "sr", "sx", ["List", 0, "_k", 1], "_x"), 1)),
    valid: and(
      equal(len, "_n"),
      all((x) => and(["LessEqual", 1, x], ["LessEqual", x, "_k"]), "_x", "x"),
      all((c) => contains("_x", c), upTo(1, "_k"), "c"),
    ),
  },
};

// Surjections sat far from SetPartitions/SetPartitionsIntoKBlocks/SetCompositions in core.ts's
// own entries array (core.ts's "subsets/multisets/tuples" section vs. its "set partitions /
// matchings" section) -- kept as two exports so collections/src/families/index.ts can splice each
// back in at its own original position.
export const surjectionsEntries: EpsilFamily[] = [surjections];

export const entries: (NumberKernel | EpsilFamily)[] = [
  setPartitionsFamily,
  kBlocks,
  {
    head: "SetCompositions",
    carrier: "SetComposition",
    paramCount: 1,
    kind: "blocks",
    count: ([n]) => Fubini(n),
    unrank: ([n], r) => LabelsToOrderedBlocks(SetCompositionUnrank(n, r)),
    valid: (b, [n]) => IsSetPartitionOf(b as number[][], n),
    rank: (b, [n]) => SetCompositionRank(BlocksToLabels(b as number[][]), n),
  },
  {
    head: "PerfectMatchings",
    carrier: "SetPartition",
    paramCount: 1,
    kind: "blocks",
    count: ([n]) => PerfectMatchingCount(n),
    unrank: ([n], r) => PerfectMatchingUnrank(n, r),
    valid: (b, [n]) => IsPerfectMatchingOf(b, n),
    rank: (b, [n]) => PerfectMatchingRank(b as number[][], n),
  },
];
