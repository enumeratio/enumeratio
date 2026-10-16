// NonCrossingPartitions/NonNestingPartitions/NonCrossingMatchings/NonNestingMatchings split out
// of collections/src/families/paths-partitions.ts (which mixed lattice-paths and
// set-partitions families) per
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 5. All four already yield "blocks" (list<list<integer>>) -- exactly SetPartition's
// shape -- so they are wired as RESTRICTIONS of SetPartition, not left bare: a non-crossing or
// non-nesting partition (or perfect matching, read as 2-element blocks) is still a set
// partition, just one obeying an extra predicate, the same relationship Derangements has to
// Permutation.
//
// The families are defined in Epsil (the second half of this file); the TS kernels in the first
// half are the independent reading tests/readings/ holds them to.
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
  rowTable,
  sub,
  upTo,
} from "../../../collections/src/families/tables.ts";
import { dyckPaths } from "../../../lattice-paths/src/families/core.ts";
import { blocksOfLabels, coversOnce, pairing, partners } from "./core.ts";
// ─── NonCrossingPartitions(n) / NonNestingPartitions(n): both built from ONE shared process —
// walk elements 1..n, at each step either open a new block (its least element) or extend one of
// the currently open block "tails" (a tail = a block's current greatest element, awaiting a
// possible successor). With `a` tails open (ascending v_1<...<v_a), extending v_j:
//   - stack rule (non-crossing): every LARGER open tail freezes forever (touching one later would
//     cross the arc just drawn) — survivors are v_1..v_{j-1}, plus the new tail.
//   - queue rule (non-nesting): every SMALLER open tail freezes forever (touching one later would
//     nest inside the arc just drawn) — survivors are v_{j+1}..v_a, plus the new tail.
// Either way exactly j-1 (stack) or a-j (queue) old tails survive, so the counting recursion
// f(t,a) = f(t-1,a+1) + sum_{m=1}^{a} f(t-1,m), f(0,a)=1, is IDENTICAL for both rules — f(n,0) =
// CatalanNumber(n). Crossing/nesting are judged on each block's CONSECUTIVE-element arcs (block
// {x1<x2<...} contributes arcs (x1,x2),(x2,x3),...), the standard arc-diagram reading under which
// non-nesting partitions are also Catalan-counted. ─────────────────────────────────────────────
export type TailMode = "stack" | "queue";
// ─── NonCrossingMatchings(n) / NonNestingMatchings(n): perfect matchings of [2n] in bijection with
// Dyck paths of semilength n — walk points 1..2n, an up-step opens a point, a down-step closes the
// MOST RECENTLY opened still-open point (stack/non-crossing, the balanced-parenthesis reading) or
// the EARLIEST still-open point (queue/non-nesting). Count = DyckPathCount(n); reuses
// IsPerfectMatchingOf from kernels-extra.ts for the base "is this a perfect matching" check. ─────
// ─── The same four in Epsil. The TS above stays as the independent reading (`readings`) the
// agreement tests check against; these are the families' definitions. ─────────────────────────

type MathJSON = unknown;

const contains = (list: MathJSON, x: MathJSON): MathJSON => ["Contains", list, x];

/** `expression` with every symbol `from` renamed `to`. */
const renamed = (expression: MathJSON, from: string, to: string): MathJSON =>
  Array.isArray(expression) ? expression.map((part) => renamed(part, from, to)) : expression === from ? to : expression;

/** The label of each of 1..n: the place of its block in `_x`. */
const blockOfEach: MathJSON = map(
  fold(add("la", iff(contains(at("_x", "lj"), "lx"), "lj", 0)), "la", "lj", 0, upTo(1, len)),
  "lx",
  upTo(1, "_n"),
);

// The tail counts f(t, a) for t = 0..n and a = 0..n + 1, as the TS table: f(t, a) is
// f(t − 1, a + 1) plus the sum of f(t − 1, 1..a).
const tailTable = rowTable(
  "g",
  add("_n", 1),
  add("_n", 2),
  () => 1,
  (prev, t, a) =>
    add(
      iff(less(add(a, 1), add("_n", 2)), prev(sub(t, 1), add(a, 1)), 0),
      fold(add("gs", prev(sub(t, 1), "gm")), "gs", "gm", 0, upTo(1, a)),
    ),
);
const F = cell("_tables", add("_n", 2));

/** What extending the j-th smallest of `a` open tails leaves, with t points to go. */
const extendWeight = (mode: TailMode, t: MathJSON, a: MathJSON, j: MathJSON): MathJSON =>
  mode === "stack" ? F(sub(t, 1), j) : F(sub(t, 1), add(sub(a, j), 1));
/** The open tails left after extending the j-th: those below it (stack) or above it (queue). */
const survivors = (mode: TailMode, tails: MathJSON, j: MathJSON): MathJSON =>
  mode === "stack" ? ["Take", tails, sub(j, 1)] : ["Drop", tails, j];

/**
 * Walking 1..n, each point opens a block or extends one of the open tails. The state is
 * [r, blocks so far, open tails, the tails' blocks…, the label of each point so far…].
 */
const tailUnrankStep = (mode: TailMode): MathJSON =>
  lets(
    [
      // The fold's state is untyped, so Take/Drop of it types as `list | string`, which the compiler rejects.
      ["tu", "ts", "list<integer>"],
      ["tr", at("tu", 1), "integer"],
      ["tb", at("tu", 2), "integer"],
      ["ta", at("tu", 3), "integer"],
      ["tt", sub(add("_n", 1), "ti"), "integer"],
      ["tl", ["Take", ["Drop", "tu", 3], "ta"], "list<integer>"],
      ["tw", ["Drop", "tu", add(3, "ta")], "list<integer>"],
      ["to", F(sub("tt", 1), add("ta", 1)), "integer"],
    ],
    iff(
      less("tr", "to"),
      ["Join", ["List", "tr", add("tb", 1), add("ta", 1)], "tl", ["List", "tb"], "tw", ["List", "tb"]],
      lets(
        [
          [
            "tf",
            fold(
              iff(
                less(0, at("tg", 2)),
                "tg",
                lets(
                  [["tx", extendWeight(mode, "tt", "ta", "tq"), "integer"]],
                  iff(less(at("tg", 1), "tx"), ["List", at("tg", 1), "tq"], ["List", sub(at("tg", 1), "tx"), 0]),
                ),
              ),
              "tg",
              "tq",
              ["List", sub("tr", "to"), 0],
              upTo(1, "ta"),
            ),
            "list<integer>",
          ],
          ["tj", at("tf", 2), "integer"],
          ["tc", at("tl", "tj"), "integer"],
          ["tk", survivors(mode, "tl", "tj"), "list<integer>"],
        ],
        ["Join", ["List", at("tf", 1), "tb", add(["Length", "tk"], 1)], "tk", ["List", "tc"], "tw", ["List", "tc"]],
      ),
    ),
  );

/** The block each point is in, the earlier point before it in that block (0 if it is the first). */
const earlierInBlock: MathJSON = map(
  fold(iff(equal(at("lb", "ez"), at("lb", "ei")), "ez", "ea"), "ea", "ez", 0, upTo(1, sub("ei", 1))),
  "ei",
  upTo(1, "_n"),
);

/**
 * Rank: replay the walk. The state is [rank, open tails (their points)…]; a point whose block
 * already has one extends that tail, and adds the choices before it.
 */
const tailRankStep = (mode: TailMode): MathJSON =>
  lets(
    [
      ["rp", at("pr", "ri"), "integer"],
      ["ra", sub(["Length", "rs"], 1), "integer"],
      ["rt", sub(add("_n", 1), "ri"), "integer"],
      ["rl", ["Drop", "rs", 1], "list<integer>"],
      ["rj", add(1, ["Count", ["Filter", "rl", ["Function", less("rv", "rp"), "rv"]]]), "integer"],
    ],
    iff(
      equal("rp", 0),
      ["Join", "rs", ["List", "ri"]],
      [
        "Join",
        [
          "List",
          add(
            at("rs", 1),
            F(sub("rt", 1), add("ra", 1)),
            fold(add("rw", extendWeight(mode, "rt", "ra", "rk")), "rw", "rk", 0, upTo(1, sub("rj", 1))),
          ),
        ],
        survivors(mode, "rl", "rj"),
        ["List", "ri"],
      ],
    ),
  );

/** Whether any two arcs (p, i), (q, k), joining a point to the one before it in its block, are `bad`. */
const noBadArcs = (bad: (earlier: (point: string) => MathJSON, i: string, k: string) => MathJSON): MathJSON =>
  lets(
    [
      ["lb", blockOfEach, "list<integer>"],
      ["pr", earlierInBlock, "list<integer>"],
    ],
    all(
      (i) =>
        all(
          (k) => [
            "Not",
            and(
              less(0, at("pr", i)),
              less(0, at("pr", k)),
              bad((point) => at("pr", point), i, k),
            ),
          ],
          upTo(1, "_n"),
          "vk",
        ),
      upTo(1, "_n"),
      "vi",
    ),
  );

function tailPartitions(head: string, mode: TailMode, bad: Parameters<typeof noBadArcs>[0]): EpsilFamily {
  const walked = fold(tailUnrankStep(mode), "ts", "ti", ["List", "_r", 0, 0], upTo(1, "_n"));
  return {
    head,
    carrier: "SetPartition",
    paramCount: 1,
    kind: "blocks",
    params: ["_n"],
    // Past doubles the table is minutes in the interpreter (the count, closed form, stays exact).
    declinePastDoubles: true,
    epsil: {
      // f(n, 0) is the Catalan number, which DyckPaths counts in closed form.
      count: dyckPaths.epsil.count,
      tables: tailTable,
      unrank: lets(
        [
          ["tz", walked, "list<integer>"],
          ["tlab", ["Drop", "tz", add(3, at("tz", 3))], "list<integer>"],
        ],
        blocksOfLabels("tlab", 0, sub(at("tz", 2), 1)),
      ),
      rank: lets(
        [
          ["lb", blockOfEach, "list<integer>"],
          ["pr", earlierInBlock, "list<integer>"],
        ],
        at(fold(tailRankStep(mode), "rs", "ri", ["List", 0], upTo(1, "_n")), 1),
      ),
      valid: and(coversOnce, noBadArcs(bad)),
    },
  };
}

// Arcs (earlier(i), i) and (earlier(k), k) cross when earlier(i) < earlier(k) < i < k, and nest
// when earlier(i) < earlier(k) and k < i.
const nonCrossingPartitions = tailPartitions("NonCrossingPartitions", "stack", (p, i, k) =>
  and(less(p(i), p(k)), less(p(k), i), less(i, k)),
);
const nonNestingPartitions = tailPartitions("NonNestingPartitions", "queue", (p, i, k) =>
  and(less(p(i), p(k)), less(k, i)),
);

// ─── NonCrossingMatchings / NonNestingMatchings: a Dyck path (DyckPaths' own definition) read as
// a matching, a down step closing the latest open point (stack) or the earliest (queue). ───────
const dyck = dyckPaths.epsil;
const steps = (expression: MathJSON): MathJSON => renamed(expression, "_x", "ms");
const bindSteps = (body: MathJSON, value: MathJSON): MathJSON => lets([["ms", value, "list<integer>"]], body);
const allPoints = upTo(1, mul(2, "_n"));

/** The points where `ms` steps up, ascending. */
const ups: MathJSON = ["Filter", allPoints, ["Function", equal(at("ms", "mp"), 1), "mp"]];
/** Pairs (up point, the down point closing it), for each up, in order. */
const pairsClosing = (partnerOf: (up: MathJSON) => MathJSON): MathJSON =>
  lets([["mu", ups, "list<integer>"]], map(["List", at("mu", "mk"), partnerOf(at("mu", "mk"))], "mk", upTo(1, "_n")));

/** The down point closing up point u (a stack matching): the first later point back at the height before u. */
const stackPartner = (u: MathJSON): MathJSON =>
  fold(
    iff(and(equal("mq", 0), equal(at("mh", "mi"), sub(at("mh", u), 1))), "mi", "mq"),
    "mq",
    "mi",
    0,
    upTo(add(u, 1), mul(2, "_n")),
  );
/** The heights after each step. */
const heights: MathJSON = map(
  sub(mul(2, fold(add("hs", at("ms", "hj")), "hs", "hj", 0, upTo(1, "hp"))), "hp"),
  "hp",
  allPoints,
);
const matchingsFrom = (head: string, mode: "stack" | "queue", bad: MathJSON): EpsilFamily => ({
  head,
  carrier: "SetPartition",
  paramCount: 1,
  kind: "blocks",
  params: ["_n"],
  epsil: {
    count: dyck.count,
    unrank: bindSteps(
      mode === "stack"
        ? lets([["mh", heights, "list<integer>"]], pairsClosing(stackPartner))
        : // a queue closes the earliest open point: the k-th down point pairs with the k-th up point
          lets(
            [
              ["mu", ups, "list<integer>"],
              ["md", ["Filter", allPoints, ["Function", equal(at("ms", "mp"), 0), "mp"]], "list<integer>"],
            ],
            map(["List", at("mu", "mk"), at("md", "mk")], "mk", upTo(1, "_n")),
          ),
      dyck.unrank,
    ),
    rank: lets(
      [["pt", partners, "list<integer>"]],
      bindSteps(steps(dyck.rank), map(iff(less("px", at("pt", "px")), 1, 0), "px", allPoints)),
    ),
    valid: and(pairing, bad),
  },
});

/** No two pairs interleave: (a, b), (c, d) with a < c < b < d. */
const noCrossing = lets(
  [
    ["lo", map(["Min", "blk"], "blk", "_x"), "list<integer>"],
    ["hi", map(["Max", "blk"], "blk", "_x"), "list<integer>"],
  ],
  all(
    (j) =>
      all(
        (k) => [
          "Not",
          and(less(at("lo", j), at("lo", k)), less(at("lo", k), at("hi", j)), less(at("hi", j), at("hi", k))),
        ],
        upTo(1, "_n"),
        "ck",
      ),
    upTo(1, "_n"),
    "cj",
  ),
);
/** No pair lies inside another: (a, b), (c, d) with a < c < d < b. */
const noNesting = lets(
  [
    ["lo", map(["Min", "blk"], "blk", "_x"), "list<integer>"],
    ["hi", map(["Max", "blk"], "blk", "_x"), "list<integer>"],
  ],
  all(
    (j) =>
      all((k) => ["Not", and(less(at("lo", j), at("lo", k)), less(at("hi", k), at("hi", j)))], upTo(1, "_n"), "nk"),
    upTo(1, "_n"),
    "nj",
  ),
);

export const entries: EpsilFamily[] = [
  nonCrossingPartitions,
  nonNestingPartitions,
  matchingsFrom("NonCrossingMatchings", "stack", noCrossing),
  matchingsFrom("NonNestingMatchings", "queue", noNesting),
];
