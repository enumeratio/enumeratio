// ParkingFunctions/NonDecreasingParkingFunctions split out of
// collections/src/families/tableaux-trees.ts (which mixed every area) per
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 5 (wire-carriers lane A-91): both now carry the "ParkingFunction" carrier
// (list<integer>). NonDecreasingParkingFunctions' elements are a RESTRICTION of ParkingFunction's
// shape (weakly increasing, not just any sequence in {1..n}) rather than a distinct carrier of
// their own — same shape, so it carries "ParkingFunction" too, same reasoning PerfectMatchings
// used for "SetPartition". PruferSequences/Tournaments/LabeledGraphs/... have since moved to
// their own areas, each now carrying its own carrier (§4 step 5).
import { nonDecreasingParkingFunctions } from "./epsil.ts";
import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import type { NumberKernel } from "../../../collections/src/families/types.ts";

const normRank = (r: number, total: number): number => (total > 0 ? ((Math.trunc(r) % total) + total) % total : 0);

// ─── ParkingFunctions(n): sequences (a_1..a_n), a_i in {1..n}, whose sorted form b satisfies
// b_i<=i (every car parks). Count (n+1)^(n-1). unrank/rank via digit-DP: M[k] tracks, while
// building a_1..a_n left to right, how many entries placed so far are <=k for every threshold k;
// the number of valid completions from position i+1 depends only on M, so it memoizes per call and
// unrank/rank walk the identical v=1..n decision order (adapted from the archived enumeratio
// checkout's packs/trees.ts, which certified this exact algorithm). ─────────────────────────────
function pfCompletions(n: number, i: number, M: number[], memo: Map<string, number>): number {
  if (i === n) {
    for (let k = 1; k <= n; k++) if (M[k] < k) return 0;
    return 1;
  }
  const key = `${i}|${M.slice(1, n + 1).join(",")}`;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  let total = 0;
  for (let v = 1; v <= n; v++) {
    const next = M.slice();
    for (let k = v; k <= n; k++) next[k]++;
    total += pfCompletions(n, i + 1, next, memo);
  }
  memo.set(key, total);
  return total;
}
export function ParkingFunctionCount(n: number): number {
  return (n + 1) ** (n - 1);
}
export function ParkingFunctionUnrank(n: number, rank: number): number[] {
  const total = ParkingFunctionCount(n);
  let r = normRank(rank, total);
  const M = new Array(n + 1).fill(0);
  const memo = new Map<string, number>();
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    for (let v = 1; v <= n; v++) {
      const next = M.slice();
      for (let k = v; k <= n; k++) next[k]++;
      const c = pfCompletions(n, i + 1, next, memo);
      if (r < c) {
        out.push(v);
        for (let k = v; k <= n; k++) M[k]++;
        break;
      }
      r -= c;
    }
  }
  return out;
}
export function ParkingFunctionRank(e: number[], n: number): number {
  const M = new Array(n + 1).fill(0);
  const memo = new Map<string, number>();
  let rank = 0;
  for (let i = 0; i < n; i++) {
    const a = e[i];
    for (let v = 1; v < a; v++) {
      const next = M.slice();
      for (let k = v; k <= n; k++) next[k]++;
      rank += pfCompletions(n, i + 1, next, memo);
    }
    for (let k = a; k <= n; k++) M[k]++;
  }
  return rank;
}
export function IsParkingFunctionOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e) || e.length !== n) return false;
  for (const x of e) if (!Number.isInteger(x) || x < 1 || x > n) return false;
  const b = (e as number[]).slice();
  b.sort((x, y) => x - y);
  for (let i = 0; i < n; i++) if (b[i] > i + 1) return false;
  return true;
}

// ─── NonDecreasingParkingFunctions(n): weakly-increasing parking functions — equivalently
// 1<=a_1<=...<=a_n<=n with a_i<=i. Count = CatalanNumber(n) (the sub-diagonal ballot sequences).
// Same digit-DP shape as ParkingFunctions above, but the state collapses to a single running lower
// bound v (since the sequence is monotone, "how many completions from position i with a_i>=v" is
// the whole story) — cheaper, and reused as-is by StandardTableaux's siblings in collections. ────
function ndpfCompletions(n: number, i: number, v: number, memo: Map<string, number>): number {
  if (i > n) return 1;
  const key = `${i},${v}`;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  let total = 0;
  for (let a = v; a <= i; a++) total += ndpfCompletions(n, i + 1, a, memo);
  memo.set(key, total);
  return total;
}
export function NonDecreasingParkingFunctionCount(n: number): number {
  return ndpfCompletions(n, 1, 1, new Map());
}
export function NonDecreasingParkingFunctionUnrank(n: number, rank: number): number[] {
  const memo = new Map<string, number>();
  const total = NonDecreasingParkingFunctionCount(n);
  let r = normRank(rank, total);
  const out: number[] = [];
  let v = 1;
  for (let i = 1; i <= n; i++) {
    for (let a = v; a <= i; a++) {
      const c = ndpfCompletions(n, i + 1, a, memo);
      if (r < c) {
        out.push(a);
        v = a;
        break;
      }
      r -= c;
    }
  }
  return out;
}
export function NonDecreasingParkingFunctionRank(e: number[], n: number): number {
  const memo = new Map<string, number>();
  let r = 0,
    v = 1;
  for (let i = 1; i <= n; i++) {
    const a = e[i - 1];
    for (let aa = v; aa < a; aa++) r += ndpfCompletions(n, i + 1, aa, memo);
    v = a;
  }
  return r;
}
export function IsNonDecreasingParkingFunctionOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e) || e.length !== n) return false;
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const a = e[i];
    if (!Number.isInteger(a) || a < 1 || a > i + 1 || a < prev) return false;
    prev = a;
  }
  return true;
}

// ParkingFunctions keeps its TS kernel: its completions depend on the whole vector of how many
// entries are at most k, so there is no table of them to define it by.
export const entries: (NumberKernel | EpsilFamily)[] = [
  {
    head: "ParkingFunctions",
    carrier: "ParkingFunction",
    paramCount: 1,
    kind: "ints",
    count: ([n]) => ParkingFunctionCount(n),
    unrank: ([n], r) => ParkingFunctionUnrank(n, r),
    valid: (e, [n]) => IsParkingFunctionOf(e, n),
    rank: (e, [n]) => ParkingFunctionRank(e as number[], n),
  },
  nonDecreasingParkingFunctions,
];
