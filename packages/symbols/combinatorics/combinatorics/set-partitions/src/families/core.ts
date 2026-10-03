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
// Surjections, SetPartitions, SetPartitionsIntoKBlocks, RestrictedGrowthStrings, SetCompositions
// and PerfectMatchings are defined in Epsil, the first four ranked through a table of
// completions; their TS kernels in collections/src/families/kernels*.ts stay as the independent
// reading the agreement tests check against.
import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
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

/** Blocks from labels: block j, for each j in from..to, holds the positions labelled j. */
export const blocksOfLabels = (labels: MathJSON, from: MathJSON, to: MathJSON): MathJSON =>
  map(["Filter", upTo(1, "_n"), ["Function", equal(at(labels, "p"), "j"), "p"]], "j", upTo(from, to));

/** Blocks from an RGS over 0..blocks − 1. */
const blocksOf = (rgs: MathJSON, blocks: MathJSON): MathJSON => blocksOfLabels(rgs, 0, sub(blocks, 1));

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
export const coversOnce: MathJSON = lets(
  [["flat", ["Flatten", "_x"], "list<integer>"]],
  and(
    equal(["Length", "flat"], "_n"),
    all((b) => ["GreaterEqual", ["Length", b], 1], "_x", "blk"),
    all((x) => contains("flat", x), upTo(1, "_n"), "x"),
  ),
);

/** Whether `_x`, a word, starts at 0 and never jumps more than one past its largest label so far. */
const growthWord: MathJSON = and(
  equal(len, "_n"),
  all(
    (i) =>
      and(
        ["LessEqual", 0, at("_x", i)],
        ["LessEqual", at("_x", i), add(1, fold(["Max", "gm", at("_x", "gj")], "gm", "gj", -1, upTo(1, sub(i, 1))))],
      ),
    upTo(1, "_n"),
    "gi",
  ),
);

/** The family's elements are its blocks, or with `word` the RGS itself (RestrictedGrowthStrings). */
function setPartitions(
  head: string,
  params: readonly string[],
  cap: MathJSON,
  last: (open: string) => MathJSON,
  word = false,
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
  const ranked = (rgs: MathJSON): MathJSON => at(fold(rankStep, "rs", "rv", ["List", 0, 0, 1], rgs), 1);
  return {
    head,
    carrier: word ? "RestrictedGrowthString" : "SetPartition",
    paramCount: params.length as 1 | 2,
    kind: word ? "ints" : "blocks",
    params,
    epsil: {
      count: withRgs(T("_n", 0)),
      unrank: withRgs(
        lets(
          [["uend", fold(unrankStep, "us", "ui", ["List", "_r", 0], upTo(1, "_n")), "list<integer>"]],
          word ? ["Drop", "uend", 2] : blocksOf(["Drop", "uend", 2], at("uend", 2)),
        ),
      ),
      rank: withRgs(word ? ranked("_x") : lets([["rgs0", rgsOfBlocks, "list<integer>"]], ranked("rgs0"))),
      valid: word ? growthWord : params.length === 1 ? coversOnce : and(equal(len, "_k"), coversOnce),
    },
  };
}

const setPartitionsFamily = setPartitions("SetPartitions", ["_n"], "_n", () => 1);
const kBlocks = setPartitions("SetPartitionsIntoKBlocks", ["_n", "_k"], "_k", (open) => iff(equal(open, "_k"), 1, 0));
/** The words themselves: a set partition's RGS, Bell(n) of them, in the same lex order. */
export const restrictedGrowthStrings = setPartitions("RestrictedGrowthStrings", ["_n"], "_n", () => 1, true);

// ─── Surjections(n, k): words over 1..k using every letter, in lex order ───
// T(rem, missing), the ways to finish rem letters with `missing` letters still unused, is
// missing·T(rem − 1, missing − 1) (a new letter) + (k − missing)·T(rem − 1, missing) (a used one).
// Written over the alphabet's size `k`, so SetCompositions can use it for the k it finds.
function surjectionsOver(k: MathJSON) {
  const table = rowTable(
    "j",
    add("_n", 1),
    add(k, 1),
    (missing) => iff(equal(missing, 0), 1, 0),
    (prev, rem, missing) =>
      add(
        iff(less(0, missing), mul(missing, prev(sub(rem, 1), sub(missing, 1))), 0),
        mul(sub(k, missing), prev(sub(rem, 1), missing)),
      ),
  );
  const S = cell("surj", add(k, 1));
  /** The completions after letter c, `used` the letters before it and rem left after it. */
  const afterLetter = (used: MathJSON, rem: MathJSON, missing: MathJSON, c: MathJSON): MathJSON =>
    iff(contains(used, c), S(rem, missing), iff(less(0, missing), S(rem, sub(missing, 1)), 0));

  // The state is [r, missing, letters…]; each step searches the letters in order, its own state
  // [r, letter, missing] once it has one.
  const unrankStep = lets(
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
            upTo(1, k),
          ),
          "list<integer>",
        ],
      ],
      ["Join", ["List", at("sc", 1), at("sc", 3)], "sw", ["List", at("sc", 2)]],
    ),
  );
  // A fold over the word itself, the state [r, missing, position].
  const rankStep = (word: MathJSON): MathJSON =>
    lets(
      [
        ["sp", ["Take", word, sub(at("sr", 3), 1)], "list<integer>"],
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
  return {
    /** `body` with the table bound. */
    withTable: (body: MathJSON): MathJSON => withTable("surj", table, body),
    count: S("_n", k),
    /** The word at rank `r`; needs the table. */
    unrank: (r: MathJSON): MathJSON => ["Drop", fold(unrankStep, "su", "si", ["List", r, k], upTo(1, "_n")), 2],
    /** The rank of `word`, a bound list; needs the table. */
    rank: (word: string): MathJSON => at(fold(rankStep(word), "sr", "sx", ["List", 0, k, 1], word), 1),
  };
}

const surjectionsOf = surjectionsOver("_k");

const surjections: EpsilFamily = {
  head: "Surjections",
  carrier: "Surjection",
  paramCount: 2,
  kind: "ints",
  params: ["_n", "_k"],
  epsil: {
    count: surjectionsOf.withTable(surjectionsOf.count),
    unrank: surjectionsOf.withTable(surjectionsOf.unrank("_r")),
    rank: surjectionsOf.withTable(surjectionsOf.rank("_x")),
    valid: and(
      equal(len, "_n"),
      all((x) => and(["LessEqual", 1, x], ["LessEqual", x, "_k"]), "_x", "x"),
      all((c) => contains("_x", c), upTo(1, "_k"), "c"),
    ),
  },
};

// ─── SetCompositions(n): ordered set partitions, by block count k then the surjection word ───
// The labels of 1..n by their block's place in the order are a surjection onto 1..k, and k
// ascending, then lex on the labels, is the order. Fub(m, k), the surjections of m letters onto
// k, is k·(Fub(m − 1, k) + Fub(m − 1, k − 1)); the count is the sum over k of Fub(n, k).
const fubiniTable = rowTable(
  "f",
  add("_n", 1),
  add("_n", 1),
  (k) => iff(equal(k, 0), 1, 0),
  (prev, m, k) => iff(equal(k, 0), 0, mul(k, add(prev(sub(m, 1), k), prev(sub(m, 1), sub(k, 1))))),
);
const Fub = cell("fub", add("_n", 1));
const withFubini = (body: MathJSON): MathJSON => withTable("fub", fubiniTable, body);
/** The surjections onto fewer than k letters, the ranks before the k-block ones. */
const surjectionsBelow = (k: MathJSON): MathJSON => fold(add("fa", Fub("_n", "fc")), "fa", "fc", 0, upTo(1, sub(k, 1)));

const composition = surjectionsOver("ck");

/** The block count k and the rank within the k-block compositions: a search over k. */
const kAndRemainder: MathJSON = fold(
  iff(
    less(0, at("ff", 2)),
    "ff",
    lets(
      [["fn", Fub("_n", "fk"), "integer"]],
      iff(less(at("ff", 1), "fn"), ["List", at("ff", 1), "fk"], ["List", sub(at("ff", 1), "fn"), 0]),
    ),
  ),
  "ff",
  "fk",
  ["List", "_r", 0],
  upTo(1, "_n"),
);

/** The label of each of 1..n: the place of its block in `_x`. */
const labelsOfOrderedBlocks: MathJSON = map(
  fold(add("la", iff(contains(at("_x", "lj"), "lx"), "lj", 0)), "la", "lj", 0, upTo(1, len)),
  "lx",
  upTo(1, "_n"),
);

const setCompositions: EpsilFamily = {
  head: "SetCompositions",
  carrier: "SetComposition",
  paramCount: 1,
  kind: "blocks",
  params: ["_n"],
  epsil: {
    // Fub(0, 0) = 1 is the empty composition; for n > 0 Fub(n, 0) = 0.
    count: withFubini(fold(add("fa", Fub("_n", "fc")), "fa", "fc", 0, upTo(0, "_n"))),
    unrank: withFubini(
      iff(
        equal("_n", 0),
        ["List"],
        lets(
          [
            ["cf", kAndRemainder, "list<integer>"],
            ["ck", at("cf", 2), "integer"],
            ["cl", composition.withTable(composition.unrank(at("cf", 1))), "list<integer>"],
          ],
          blocksOfLabels("cl", 1, "ck"),
        ),
      ),
    ),
    rank: withFubini(
      lets(
        [
          ["cl", labelsOfOrderedBlocks, "list<integer>"],
          ["ck", len, "integer"],
        ],
        add(surjectionsBelow("ck"), composition.withTable(composition.rank("cl"))),
      ),
    ),
    valid: coversOnce,
  },
};

// ─── PerfectMatchings(n): pairings of 1..2n, the least point's partner first ───
// Taking the least point left and choosing its partner among the 2(n − i) + 1 others, i = 1..n,
// each choice leaves (2(n − i) − 1)!! completions: the rank is a mixed-radix number whose digits
// are the partners' places among the points still free.
/** (2k − 1)!!, the product of the first k odd numbers. */
const oddProduct = (k: MathJSON, tag: string): MathJSON =>
  fold(mul(`${tag}a`, sub(mul(2, `${tag}t`), 1)), `${tag}a`, `${tag}t`, 1, upTo(1, k));

/** The place of step i's partner among the free points: digit i of `_r`. */
const partnerPlace = (i: MathJSON): MathJSON => [
  "Mod",
  quotient("_r", oddProduct(sub("_n", i), "po")),
  add(mul(2, sub("_n", i)), 1),
];

// The state is each point's partner so far, 0 while it is free. Step i pairs the least free point
// with the free point above it that has `pd` free points between them, filling the list in place.
const matchStep = lets(
  [
    ["pd", partnerPlace("pi"), "integer"],
    [
      "pp",
      fold(iff(and(equal("pa", 0), equal(at("ps", "py"), 0)), "py", "pa"), "pa", "py", 0, upTo(1, mul(2, "_n"))),
      "integer",
    ],
    [
      "pq",
      at(
        // the state [free points above pp seen, the one wanted]
        fold(
          iff(
            and(less("pp", "pw"), equal(at("ps", "pw"), 0)),
            iff(
              equal(at("pn", 1), "pd"),
              ["List", add(at("pn", 1), 1), "pw"],
              ["List", add(at("pn", 1), 1), at("pn", 2)],
            ),
            "pn",
          ),
          "pn",
          "pw",
          ["List", 0, 0],
          upTo(1, mul(2, "_n")),
        ),
        2,
      ),
      "integer",
    ],
  ],
  ["ReplaceAt", ["ReplaceAt", "ps", "pp", "pq"], "pq", "pp"],
);
const matched: MathJSON = fold(matchStep, "ps", "pi", map(0, "pz0", upTo(1, mul(2, "_n"))), upTo(1, "_n"));

/** The partner of each of 1..2n, from the pairs in `_x` in any order. */
export const partners: MathJSON = lets(
  [
    ["pmn", map(["Min", "blk"], "blk", "_x"), "list<integer>"],
    ["pmx", map(["Max", "blk"], "blk", "_x"), "list<integer>"],
  ],
  map(
    fold(
      iff(equal(at("pmn", "pj"), "pp"), at("pmx", "pj"), iff(equal(at("pmx", "pj"), "pp"), at("pmn", "pj"), "pq")),
      "pq",
      "pj",
      0,
      upTo(1, len),
    ),
    "pp",
    upTo(1, mul(2, "_n")),
  ),
);

const partnerOf = (p: MathJSON): MathJSON => at("pt", p);
/** Free points above p, below p's partner, still free when p is taken: p's partner's place. */
const placeOfPartner = (p: MathJSON): MathJSON =>
  fold(add("py", iff(less(p, partnerOf("pu")), 1, 0)), "py", "pu", 0, upTo(add(p, 1), sub(partnerOf(p), 1)));
/** How many pairs have their least point before p. */
const pairsBefore = (p: MathJSON): MathJSON =>
  fold(add("pc", iff(less("pz", partnerOf("pz")), 1, 0)), "pc", "pz", 0, upTo(1, sub(p, 1)));

/** `_x` is n pairs of two: they cover 1..2n once each exactly when every point appears. */
export const pairing: MathJSON = and(
  equal(len, "_n"),
  all((b) => equal(["Length", b], 2), "_x", "blk"),
  lets(
    [["flat", ["Flatten", "_x"], "list<integer>"]],
    all((y) => contains("flat", y), upTo(1, mul(2, "_n")), "y"),
  ),
);

const perfectMatchings: EpsilFamily = {
  head: "PerfectMatchings",
  carrier: "SetPartition",
  paramCount: 1,
  kind: "blocks",
  params: ["_n"],
  epsil: {
    count: iff(less("_n", 0), 0, oddProduct("_n", "pc")),
    unrank: lets(
      [
        ["pm", matched, "list<integer>"],
        ["pl", ["Filter", upTo(1, mul(2, "_n")), ["Function", less("pf", at("pm", "pf")), "pf"]], "list<integer>"],
      ],
      map(["List", at("pl", "pk"), at("pm", at("pl", "pk"))], "pk", upTo(1, "_n")),
    ),
    rank: lets(
      [["pt", partners, "list<integer>"]],
      fold(
        add(
          "pa",
          iff(
            less("px", partnerOf("px")),
            lets(
              // the weight's length is read once, not in the product's Range
              [["pb", sub(sub("_n", pairsBefore("px")), 1), "integer"]],
              mul(placeOfPartner("px"), oddProduct("pb", "pr")),
            ),
            0,
          ),
        ),
        "pa",
        "px",
        0,
        upTo(1, mul(2, "_n")),
      ),
    ),
    valid: pairing,
  },
};

// Surjections sat far from SetPartitions/SetPartitionsIntoKBlocks/SetCompositions in core.ts's
// own entries array (core.ts's "subsets/multisets/tuples" section vs. its "set partitions /
// matchings" section) -- kept as two exports so collections/src/families/index.ts can splice each
// back in at its own original position.
export const surjectionsEntries: EpsilFamily[] = [surjections];

export const entries: EpsilFamily[] = [setPartitionsFamily, kBlocks, setCompositions, perfectMatchings];
