// StandardTableauPairs moved out of collections/src/families/tableaux-plane.ts (§4 step 5,
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible):
// it now carries "StandardTableauPair" (tuple<standard_tableau, standard_tableau>). Its element
// (kind "nested", `[P, Q]`, each a tableau's rows) doesn't pack into that tuple as-is -- CE's
// tuple type doesn't structurally accept a plain nested List -- so each slot is wrapped in its
// own StandardTableau(...) first (`carrierElements`, declare.ts), holding its rows exactly as
// the kernel already has them (StandardTableau's shape is `list<list<integer>>`, matching
// src/maps.ts's Rsk/RskInsertion/RskRecording) -- the same idea as `carrierParams` (#437-style
// packs raw params instead), applied to a sub-element rather than a param.
import type { EpsilFamily, FastKernel } from "../../../collections/src/families/epsil.ts";
import { Factorial, PermutationRank, PermutationUnrank } from "../../../collections/src/families/kernels.ts";
import { IsStandardTableauOf } from "../../../collections/src/families/tableaux-trees.ts";
import { standardTableauPairs } from "./rsk-pairs.ts";

const normRank = (r: number, total: number): number => (total > 0 ? ((Math.trunc(r) % total) + total) % total : 0);

// Defined in Epsil (./rsk-pairs.ts), interpreted since the element is nested: the kernel below is its
// fast path, in the same order.
// ═══ StandardTableauPairs(size) — the RSK codomain: pairs (P,Q) of same-shape SYT, n cells ═══
// RSK is a bijection permutations(n) ↔ {(P,Q)}, so count = n! (exact, closed-form) and unrank/rank ride
// straight on PermutationUnrank/Rank (kernels.ts) through forward/inverse RSK insertion. Element: `[P, Q]`
// (kind "nested" — the two same-shape tableaux don't pack into one ragged number[][] the way the other
// composite carriers above do).
function rsk(perm: readonly number[]): { P: number[][]; Q: number[][] } {
  const P: number[][] = [];
  const Q: number[][] = [];
  for (let k = 0; k < perm.length; k++) {
    let x = perm[k];
    let r = 0;
    for (;;) {
      if (r === P.length) {
        P.push([x]);
        Q.push([k + 1]);
        break;
      }
      const row = P[r];
      const pos = row.findIndex((v) => v > x);
      if (pos === -1) {
        row.push(x);
        Q[r].push(k + 1);
        break;
      }
      const bumped = row[pos];
      row[pos] = x;
      x = bumped;
      r++;
    }
  }
  return { P, Q };
}
function rskInverse(Pin: readonly number[][], Qin: readonly number[][]): number[] {
  const P = Pin.map((row) => row.slice());
  const Q = Qin.map((row) => row.slice());
  const n = P.reduce((a, row) => a + row.length, 0);
  const perm: number[] = Array.from({ length: n }, () => 0);
  for (let k = n; k >= 1; k--) {
    let r = -1;
    for (let i = 0; i < Q.length; i++) {
      if (Q[i].length && Q[i][Q[i].length - 1] === k) {
        r = i;
        break;
      }
    }
    Q[r].pop();
    let x = P[r].pop() as number;
    for (let i = r - 1; i >= 0; i--) {
      const row = P[i];
      let pos = -1;
      for (let j = row.length - 1; j >= 0; j--)
        if (row[j] < x) {
          pos = j;
          break;
        }
      const bumped = row[pos];
      row[pos] = x;
      x = bumped;
    }
    perm[k - 1] = x;
  }
  return perm;
}
export function StandardTableauPairsUnrank(n: number, rank: number): [number[][], number[][]] {
  const total = Factorial(n);
  const r = normRank(rank, total);
  const { P, Q } = rsk(PermutationUnrank(n, r));
  return [P, Q];
}
export function StandardTableauPairsRank(pair: [number[][], number[][]], n: number): number {
  void n;
  return PermutationRank(rskInverse(pair[0], pair[1]));
}
export function IsStandardTableauPairOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e) || e.length !== 2) return false;
  const [P, Q] = e as [number[][], number[][]];
  if (!IsStandardTableauOf(P, n) || !IsStandardTableauOf(Q, n)) return false;
  const shapeOf = (t: number[][]) => t.map((row) => row.length).join(",");
  return shapeOf(P) === shapeOf(Q);
}

export const standardTableauPairsFast: FastKernel = {
  count: ([n]) => Factorial(n),
  unrank: ([n], r) => StandardTableauPairsUnrank(n, r),
  rank: (e, [n]) => StandardTableauPairsRank(e as [number[][], number[][]], n),
  valid: (e, [n]) => IsStandardTableauPairOf(e, n),
};

export const entries: EpsilFamily[] = [{ ...standardTableauPairs, fast: standardTableauPairsFast }];
