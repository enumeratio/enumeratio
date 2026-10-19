// Moved out of the runtime by BL-225: kernels only tests/readings and the agreement tests use.
import {
  KAryTreeCount,
  KAryTreeRank,
  KAryTreeUnrank,
  type KTree,
} from "../../../collections/src/families/kernels-extra.ts";
import { type NumberKernel } from "../../../collections/src/families/types.ts";

export function NonCrossingTreeCount(n: number): number {
  return KAryTreeCount(n, 3);
}

// ─── NonCrossingTrees(n): A001764 — spanning trees on n+1 circle-labeled points with no crossing
// chords; C(3n,n)/(2n+1), the same Fuss–Catalan closed form as ternary trees with n internal nodes
// (Flajolet & Noy, "Analytic combinatorics of non-crossing configurations", 1999, give the bijection
// explicitly). Reuses the already-certified FullKAryTrees(n,3) kernel and just re-presents its nested
// element as the flat preorder arity word (n entries, each in 0..3) the "ints" carrier wants. ──────
export function flattenKAry(t: KTree, k: number, out: number[]): void {
  if (t === 0) {
    out.push(0);
    return;
  }
  out.push(k);
  for (const c of t) flattenKAry(c, k, out);
}

export function NonCrossingTreeUnrank(n: number, rank: number): number[] {
  const t = KAryTreeUnrank(n, 3, rank);
  const out: number[] = [];
  flattenKAry(t, 3, out);
  return out;
}

export function IsNonCrossingTreeOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e)) return false;
  // a valid preorder arity word: a single stack-based scan consumes exactly the whole word once,
  // with exactly n internal (arity-3) nodes — the n-internal-node ternary tree the bijection wants.
  let need = 1;
  let internal = 0;
  for (const a of e) {
    if (a !== 0 && a !== 3) return false;
    if (a === 3) internal++;
    need--;
    if (need < 0) return false;
    need += a;
  }
  return need === 0 && internal === n;
}

export function unflattenKAry(word: number[], pos: { i: number }): KTree {
  const a = word[pos.i++];
  if (a === 0) return 0;
  const kids: KTree[] = [];
  for (let c = 0; c < a; c++) kids.push(unflattenKAry(word, pos));
  return kids as KTree; // a is always exactly 3 here (FullKAryTrees(·,3) fills every internal node's 3 slots)
}

export function NonCrossingTreeRank(word: number[]): number {
  const t = unflattenKAry(word, { i: 0 });
  return KAryTreeRank(t, 3);
}

export const nonCrossingTreesKernel: NumberKernel = {
  head: "NonCrossingTrees",
  paramCount: 1,
  kind: "ints",
  carrier: "NonCrossingTree",
  count: ([n]) => NonCrossingTreeCount(n),
  unrank: ([n], r) => NonCrossingTreeUnrank(n, r),
  valid: (e, [n]) => IsNonCrossingTreeOf(e, n),
  rank: (e) => NonCrossingTreeRank(e as number[]),
};
