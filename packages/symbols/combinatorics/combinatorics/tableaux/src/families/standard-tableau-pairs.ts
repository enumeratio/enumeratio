// StandardTableauPairs moved out of collections/src/families/tableaux-plane.ts (§4 step 5,
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible):
// it now carries "StandardTableauPair" (tuple<standard_tableau, standard_tableau>). Its element
// (kind "nested", `[P, Q]`, each a tableau's rows) doesn't pack into that tuple as-is -- CE's
// tuple type doesn't structurally accept a plain nested List, and StandardTableau's own shape is
// a row word (`list<integer>`, matching how src/maps.ts's `Rsk` already builds one), not rows.
// So each slot is FLATTENED and wrapped in its own StandardTableau(...) first (`carrierElements`,
// declare.ts) -- the same idea as `carrierParams` (#437-style packs raw params instead), applied
// to a sub-element rather than a param. See IsStandardTableauPairOf below for what that costs on
// the way back (a row word alone doesn't always determine a shape).
import type { NumberKernel } from "../../../collections/src/families/types.ts";
import { Factorial, PermutationRank, PermutationUnrank } from "../../../collections/src/families/kernels.ts";
import { IsStandardTableauOf } from "../../../collections/src/families/tableaux-trees.ts";
import { PartitionsP, IntegerPartitionUnrank } from "../../../collections/src/families/kernels-combinatorics.ts";

const normRank = (r: number, total: number): number => (total > 0 ? ((Math.trunc(r) % total) + total) % total : 0);

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
// A row word alone doesn't determine a shape (word "1,2,3,4" is both the single row [1,2,3,4]
// and the two rows [1,2],[3,4] -- both genuine SYT): the carrier only ever holds the word, so a
// value that arrives through it (declare.ts's `contains`, decoding a StandardTableauPair back
// off the engine) needs a shape reconstructed from context. Two words sharing a shape is exactly
// the constraint that disambiguates most of the time -- try every shape of n, largest-part-first
// (the same order StandardTableauxUnrank enumerates), first one both words split into validly.
// Collisions this can't resolve (two different pairs sharing both row words) are the carrier's
// own limitation, already accepted for the `Rsk` map (src/maps.ts): "the pair plus RskShape
// determines them."
function rowsFromWord(word: readonly number[], shape: readonly number[]): number[][] | undefined {
  const rows: number[][] = [];
  let at = 0;
  for (const len of shape) {
    rows.push(word.slice(at, at + len));
    at += len;
  }
  return at === word.length ? rows : undefined;
}
function standardTableauPairFromWords(
  wordP: readonly number[],
  wordQ: readonly number[],
  n: number,
): [number[][], number[][]] | undefined {
  if (wordP.length !== n || wordQ.length !== n) return undefined;
  for (let idx = 0; idx < PartitionsP(n); idx++) {
    const shape = IntegerPartitionUnrank(n, idx);
    const rowsP = rowsFromWord(wordP, shape);
    const rowsQ = rowsFromWord(wordQ, shape);
    if (rowsP && rowsQ && IsStandardTableauOf(rowsP, n) && IsStandardTableauOf(rowsQ, n)) return [rowsP, rowsQ];
  }
  return undefined;
}
export function IsStandardTableauPairOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e) || e.length !== 2) return false;
  const [a, b] = e as [unknown, unknown];
  // A flat row word (declare.ts's decode) is an array of numbers; nested rows (the kernel's own
  // unrank/rank contract) is an array of arrays.
  const isFlatWord = Array.isArray(a) && (a.length === 0 || typeof a[0] === "number");
  const pair = isFlatWord
    ? standardTableauPairFromWords(a as number[], b as number[], n)
    : ([a, b] as [number[][], number[][]]);
  if (pair === undefined) return false;
  const [P, Q] = pair;
  if (!IsStandardTableauOf(P, n) || !IsStandardTableauOf(Q, n)) return false;
  const shapeOf = (t: number[][]) => t.map((row) => row.length).join(",");
  return shapeOf(P) === shapeOf(Q);
}

export const entries: NumberKernel[] = [
  {
    head: "StandardTableauPairs",
    paramCount: 1,
    kind: "nested",
    carrier: "StandardTableauPair",
    carrierElements: ["StandardTableau", "StandardTableau"],
    count: ([n]) => Factorial(n),
    unrank: ([n], r) => StandardTableauPairsUnrank(n, r),
    valid: (e, [n]) => IsStandardTableauPairOf(e, n),
    rank: (e, [n]) => StandardTableauPairsRank(e as [number[][], number[][]], n),
  },
];
