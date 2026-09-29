// NonCrossingPartitions/NonNestingPartitions/NonCrossingMatchings/NonNestingMatchings split out
// of collections/src/families/paths-partitions.ts (which mixed lattice-paths and
// set-partitions families) per
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 5. All four already yield "blocks" (list<list<integer>>) -- exactly SetPartition's
// shape -- so they are wired as RESTRICTIONS of SetPartition, not left bare: a non-crossing or
// non-nesting partition (or perfect matching, read as 2-element blocks) is still a set
// partition, just one obeying an extra predicate, the same relationship Derangements has to
// Permutation.
import type { NumberKernel } from "../../../collections/src/families/types.ts";
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

export const entries: NumberKernel[] = [
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
