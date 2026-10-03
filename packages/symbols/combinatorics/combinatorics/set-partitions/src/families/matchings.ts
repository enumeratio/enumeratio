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
// half stay as the independent reading the agreement tests check against.
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
  withTable,
} from "../../../collections/src/families/tables.ts";
import type { NumberKernel } from "../../../collections/src/families/types.ts";
import { dyckPaths } from "../../../lattice-paths/src/families/core.ts";
import { blocksOfLabels, coversOnce, pairing, partners } from "./core.ts";
import {
  CatalanNumber,
  DyckPathCount,
  DyckPathRank,
  DyckPathUnrank,
  IsPerfectMatchingOf,
} from "../../../collections/src/families/kernels-extra.ts";

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
type TailMode = "stack" | "queue";

const _tailTableMemo = new Map<number, number[][]>();
function buildTailLevelTable(n: number): number[][] {
  const cached = _tailTableMemo.get(n);
  if (cached) return cached;
  const maxA = n + 1;
  const f: number[][] = Array.from({ length: n + 1 }, () => new Array(maxA + 1).fill(0));
  for (let a = 0; a <= maxA; a++) f[0][a] = 1;
  for (let t = 1; t <= n; t++) {
    const prev = f[t - 1];
    const prefix = new Array(maxA + 1).fill(0);
    for (let a = 1; a <= maxA; a++) prefix[a] = prefix[a - 1] + prev[a];
    for (let a = 0; a <= maxA; a++) f[t][a] = (a + 1 <= maxA ? prev[a + 1] : 0) + prefix[a];
  }
  _tailTableMemo.set(n, f);
  return f;
}

/** Weight of "extend the j-th-smallest (1-indexed) of `a` open tails" at level `t-1`. */
function tailExtendWeight(f: number[][], t: number, a: number, j: number, mode: TailMode): number {
  return mode === "stack" ? f[t - 1][j] : f[t - 1][a - j + 1];
}

/** Which open tails (0-indexed slice of the ascending `available` array) survive extending index j-1. */
function tailSurvivors<T>(available: T[], j: number, mode: TailMode): T[] {
  return mode === "stack" ? available.slice(0, j - 1) : available.slice(j);
}

function unrankTailPartition(n: number, r: number, mode: TailMode): number[][] {
  if (n === 0) return [];
  const f = buildTailLevelTable(n);
  let available: Array<{ value: number; blockId: number }> = [];
  const blocks: number[][] = [];
  let rem = r;
  for (let i = 1; i <= n; i++) {
    const a = available.length;
    const t = n - i + 1;
    const openSize = f[t - 1][a + 1];
    if (rem < openSize) {
      const blockId = blocks.length;
      blocks.push([i]);
      available = [...available, { value: i, blockId }];
      continue;
    }
    rem -= openSize;
    let j = 1;
    for (;;) {
      const size = tailExtendWeight(f, t, a, j, mode);
      if (rem < size) break;
      rem -= size;
      j++;
    }
    const chosen = available[j - 1];
    blocks[chosen.blockId].push(i);
    available = [...tailSurvivors(available, j, mode), { value: i, blockId: chosen.blockId }];
  }
  return blocks;
}

function rankTailPartition(blocks: number[][], n: number, mode: TailMode): number {
  const blockIndexOf = new Array(n + 1).fill(-1);
  blocks.forEach((b, bi) => b.forEach((x) => (blockIndexOf[x] = bi)));
  const predOf = new Array(n + 1).fill(0); // predOf[x] = element right before x in its block (0 = block minimum)
  blocks.forEach((b) => {
    const sorted = [...b];
    sorted.sort((x, y) => x - y);
    for (let k = 1; k < sorted.length; k++) predOf[sorted[k]] = sorted[k - 1];
  });
  const f = buildTailLevelTable(n);
  let available: Array<{ value: number; blockId: number }> = [];
  let rank = 0;
  for (let i = 1; i <= n; i++) {
    const a = available.length;
    const t = n - i + 1;
    const bi = blockIndexOf[i];
    if (predOf[i] === 0) {
      available = [...available, { value: i, blockId: bi }];
      continue; // "open new block" is always ordered first — contributes 0 to rank
    }
    const p = predOf[i];
    const idx = available.findIndex((en) => en.value === p);
    const j = idx + 1;
    rank += f[t - 1][a + 1]; // the open-branch precedes every extend-branch
    for (let jj = 1; jj < j; jj++) rank += tailExtendWeight(f, t, a, jj, mode);
    available = [...tailSurvivors(available, j, mode), { value: i, blockId: bi }];
  }
  return rank;
}

function canonicalBlocksOf(e: unknown): number[][] | undefined {
  if (!Array.isArray(e)) return undefined;
  const out: number[][] = [];
  const seen = new Set<number>();
  for (const b of e) {
    if (!Array.isArray(b) || b.length === 0) return undefined;
    const sorted = [...b];
    sorted.sort((x, y) => x - y);
    for (const x of sorted) {
      if (typeof x !== "number" || !Number.isInteger(x) || seen.has(x)) return undefined;
      seen.add(x);
    }
    out.push(sorted);
  }
  return out;
}

function isSetPartitionShape(blocks: number[][], n: number): boolean {
  let total = 0;
  for (const b of blocks) {
    for (const x of b) {
      if (x < 1 || x > n) return false;
      total++;
    }
  }
  return total === n;
}

function blockIndexArray(blocks: number[][], n: number): number[] {
  const blockOf = new Array(n + 1).fill(-1);
  blocks.forEach((b, bi) => b.forEach((x) => (blockOf[x] = bi)));
  return blockOf;
}

/** No a<b<c<d with a,c in one block and b,d in another (their arcs interleave). */
function hasCrossingBlocks(blockOf: number[], n: number): boolean {
  for (let a = 1; a <= n; a++)
    for (let b = a + 1; b <= n; b++)
      for (let c = b + 1; c <= n; c++)
        for (let d = c + 1; d <= n; d++)
          if (blockOf[a] === blockOf[c] && blockOf[b] === blockOf[d] && blockOf[a] !== blockOf[b]) return true;
  return false;
}

/** No consecutive-in-block arc (i1,i2) properly containing a consecutive-in-block arc (j1,j2)
 *  from a different block: i1<j1<j2<i2. */
function hasNestingBlocks(blocks: number[][]): boolean {
  const arcs: Array<[number, number]> = [];
  for (const b of blocks) for (let k = 1; k < b.length; k++) arcs.push([b[k - 1], b[k]]);
  for (let i = 0; i < arcs.length; i++)
    for (let j = 0; j < arcs.length; j++) {
      if (i === j) continue;
      const [i1, i2] = arcs[i];
      const [j1, j2] = arcs[j];
      if (i1 < j1 && j2 < i2) return true;
    }
  return false;
}

// ─── NonCrossingMatchings(n) / NonNestingMatchings(n): perfect matchings of [2n] in bijection with
// Dyck paths of semilength n — walk points 1..2n, an up-step opens a point, a down-step closes the
// MOST RECENTLY opened still-open point (stack/non-crossing, the balanced-parenthesis reading) or
// the EARLIEST still-open point (queue/non-nesting). Count = DyckPathCount(n); reuses
// IsPerfectMatchingOf from kernels-extra.ts for the base "is this a perfect matching" check. ─────
type MatchMode = "stack" | "queue";

function matchingFromDyckSteps(steps: number[], mode: MatchMode): number[][] {
  const open: number[] = [];
  const pairs: number[][] = [];
  for (let i = 0; i < steps.length; i++) {
    const point = i + 1;
    if (steps[i] === 1) {
      open.push(point);
    } else {
      const partner = (mode === "stack" ? open.pop() : open.shift()) as number;
      pairs.push([Math.min(partner, point), Math.max(partner, point)]);
    }
  }
  pairs.sort((a, b) => a[0] - b[0]);
  return pairs;
}

function dyckStepsFromMatching(pairs: number[][], n: number, mode: MatchMode): number[] {
  const partnerOf = new Array(2 * n + 1).fill(0);
  for (const [a, b] of pairs) {
    partnerOf[a] = b;
    partnerOf[b] = a;
  }
  const steps: number[] = [];
  const open: number[] = [];
  for (let point = 1; point <= 2 * n; point++) {
    if (partnerOf[point] > point) {
      steps.push(1);
      open.push(point);
    } else {
      steps.push(0);
      if (mode === "stack") open.pop();
      else open.shift();
    }
  }
  return steps;
}

function hasCrossingChords(pairs: number[][]): boolean {
  for (const [a, b] of pairs) for (const [c, d] of pairs) if (a < c && c < b && b < d) return true;
  return false;
}

function hasNestingChords(pairs: number[][]): boolean {
  for (const [a, b] of pairs) for (const [c, d] of pairs) if (a < c && d < b) return true;
  return false;
}

export const readings: NumberKernel[] = [
  {
    head: "NonCrossingPartitions",
    carrier: "SetPartition",
    paramCount: 1,
    kind: "blocks",
    count: ([n]) => CatalanNumber(n),
    unrank: ([n], r) => unrankTailPartition(n, r, "stack"),
    valid: (e, [n]) => {
      const blocks = canonicalBlocksOf(e);
      if (!blocks || !isSetPartitionShape(blocks, n)) return false;
      return !hasCrossingBlocks(blockIndexArray(blocks, n), n);
    },
    rank: (e, [n]) => rankTailPartition(e as number[][], n, "stack"),
  },
  {
    head: "NonNestingPartitions",
    carrier: "SetPartition",
    paramCount: 1,
    kind: "blocks",
    count: ([n]) => CatalanNumber(n),
    unrank: ([n], r) => unrankTailPartition(n, r, "queue"),
    valid: (e, [n]) => {
      const blocks = canonicalBlocksOf(e);
      if (!blocks || !isSetPartitionShape(blocks, n)) return false;
      return !hasNestingBlocks(blocks);
    },
    rank: (e, [n]) => rankTailPartition(e as number[][], n, "queue"),
  },
  {
    head: "NonCrossingMatchings",
    carrier: "SetPartition",
    paramCount: 1,
    kind: "blocks",
    count: ([n]) => DyckPathCount(n),
    unrank: ([n], r) => matchingFromDyckSteps(DyckPathUnrank(n, r), "stack"),
    valid: (e, [n]) => IsPerfectMatchingOf(e, n) && !hasCrossingChords(e as number[][]),
    rank: (e, [n]) => DyckPathRank(dyckStepsFromMatching(e as number[][], n, "stack")),
  },
  {
    head: "NonNestingMatchings",
    carrier: "SetPartition",
    paramCount: 1,
    kind: "blocks",
    count: ([n]) => DyckPathCount(n),
    unrank: ([n], r) => matchingFromDyckSteps(DyckPathUnrank(n, r), "queue"),
    valid: (e, [n]) => IsPerfectMatchingOf(e, n) && !hasNestingChords(e as number[][]),
    rank: (e, [n]) => DyckPathRank(dyckStepsFromMatching(e as number[][], n, "queue")),
  },
];

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
const F = cell("tails", add("_n", 2));
const withTails = (body: MathJSON): MathJSON => withTable("tails", tailTable, body);

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
      ["tr", at("ts", 1), "integer"],
      ["tb", at("ts", 2), "integer"],
      ["ta", at("ts", 3), "integer"],
      ["tt", sub(add("_n", 1), "ti"), "integer"],
      ["tl", ["Take", ["Drop", "ts", 3], "ta"], "list<integer>"],
      ["tw", ["Drop", "ts", add(3, "ta")], "list<integer>"],
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
      unrank: withTails(
        lets(
          [
            ["tz", walked, "list<integer>"],
            ["tlab", ["Drop", "tz", add(3, at("tz", 3))], "list<integer>"],
          ],
          blocksOfLabels("tlab", 0, sub(at("tz", 2), 1)),
        ),
      ),
      rank: withTails(
        lets(
          [
            ["lb", blockOfEach, "list<integer>"],
            ["pr", earlierInBlock, "list<integer>"],
          ],
          at(fold(tailRankStep(mode), "rs", "ri", ["List", 0], upTo(1, "_n")), 1),
        ),
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
