// SkewPartitions split out of collections/src/families/tableaux-plane.ts (which mixed every area)
// per https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 5. Judgment call: SkewPartitions has no top-level `carrier` (not yet typed through
// `carrierTypes`), only a `declared.carrier: "SkewPartition"` -- Plausible's catalogue label --
// and it was colocated in tableaux-plane.ts with tableaux-carrier families (PlanePartitions,
// AlternatingSignMatrices, SkewStandardTableaux, ...). Since `SkewPartition` is declared as a
// partitions-area carrier (partitions/src/carrier-data.ts), not a tableaux one, this family
// belongs here by domain even though its file neighbors stay in tableaux-plane.ts (moved in the
// tableaux-area commit). `cmpNumArrays`, `indexedFamily`, `normRank`, `keyOf`, `axis`,
// `enumerated` are small local helpers duplicated from the source file (mirrors how the
// permutations pilot duplicated `ints`).
import type { Cost, Declared, NumberKernel, Param } from "../../../collections/src/families/types.ts";

const normRank = (r: number, total: number): number => (total > 0 ? ((Math.trunc(r) % total) + total) % total : 0);

const cmpNumArrays = (a: readonly number[], b: readonly number[]): number => {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
};

const keyOf = (rows: unknown): string => JSON.stringify(rows);

/** A memoized "enumerate every element, cache it, index into it" table -- see the source file's
 *  own doc comment for why this is correct by construction. */
function indexedFamily<E>(generate: (key: string) => E[]) {
  const cache = new Map<string, E[]>();
  const elementsOf = (key: string): E[] => {
    let v = cache.get(key);
    if (!v) {
      v = generate(key);
      cache.set(key, v);
    }
    return v;
  };
  return {
    count: (key: string) => elementsOf(key).length,
    unrank: (key: string, rank: number) => elementsOf(key)[normRank(rank, elementsOf(key).length)],
    rank: (key: string, element: unknown) => elementsOf(key).findIndex((e) => keyOf(e) === keyOf(element)),
  };
}

const axis = (name: string): Param => ({ name, role: "axis", min: 0 });
/** SkewPartitions enumerates to unrank and rank (indexedFamily); `count` is its own. */
const enumerated = (count: Cost): Declared["cost"] => ({
  count,
  unrank: "enumerative",
  rank: "enumerative",
  valid: "polynomial",
});

// ═══ SkewPartitions(size) — REDUCED skew shapes λ/μ with `size` cells (Sage SkewPartitions(n)) ═══
// "Reduced" = no empty row (μ_i < λ_i) and no empty column (every column 1..λ_1 covered by some row's
// [μ_i+1, λ_i]). No closed form (ported from the archived checkout's own comment) — count is the cached
// enumeration's length. Element: `[lam, mu]`.
function isColumnReduced(aStarts: readonly number[], bEnds: readonly number[]): boolean {
  const maxCol = bEnds[0] ?? 0;
  for (let col = 1; col <= maxCol; col++) {
    let covered = false;
    for (let i = 0; i < bEnds.length; i++)
      if (aStarts[i] <= col && col <= bEnds[i]) {
        covered = true;
        break;
      }
    if (!covered) return false;
  }
  return true;
}
// Exported (not just the Unrank/Rank/Is* wrappers below): SkewStandardTableaux in the source
// file's tableaux-plane.ts still enumerates over every skew shape via this same cached table.
export const skewPart = indexedFamily<[number[], number[]]>((key) => {
  const n = Number(key);
  const results: [number[], number[]][] = [];
  const aStarts: number[] = [];
  const bEnds: number[] = [];
  function backtrack(cells: number): void {
    if (cells === n) {
      if (isColumnReduced(aStarts, bEnds)) {
        const lam = bEnds.slice();
        const mu = aStarts.map((a) => a - 1).filter((x) => x > 0);
        results.push([lam, mu]);
      }
      return;
    }
    const prevB = bEnds.length ? bEnds[bEnds.length - 1] : n;
    for (let b = 1; b <= prevB; b++) {
      const prevA = aStarts.length ? aStarts[aStarts.length - 1] : b;
      for (let a = 1; a <= Math.min(b, prevA); a++) {
        const rowCells = b - a + 1;
        if (cells + rowCells > n) continue;
        aStarts.push(a);
        bEnds.push(b);
        backtrack(cells + rowCells);
        aStarts.pop();
        bEnds.pop();
      }
    }
  }
  backtrack(0);
  results.sort((x, y) => cmpNumArrays(x[0], y[0]) || cmpNumArrays(x[1], y[1]));
  return results;
});
export function SkewPartitionsUnrank(n: number, rank: number): [number[], number[]] {
  return skewPart.unrank(String(n), rank);
}
export function SkewPartitionsRank(e: [number[], number[]], n: number): number {
  return skewPart.rank(String(n), e);
}
export function IsSkewPartitionOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e) || e.length !== 2) return false;
  const [lam, mu] = e as [number[], number[]];
  if (!Array.isArray(lam) || !Array.isArray(mu) || mu.length > lam.length) return false;
  for (let i = 0; i < lam.length; i++) {
    if (!Number.isInteger(lam[i]) || lam[i] < 1) return false;
    if (i > 0 && lam[i] > lam[i - 1]) return false;
    const m = mu[i] ?? 0;
    if (!Number.isInteger(m) || m < 0) return false;
    if (i > 0 && m > (mu[i - 1] ?? 0)) return false;
    if (m >= lam[i]) return false;
  }
  const totalLam = lam.reduce((a, b) => a + b, 0);
  const totalMu = mu.reduce((a, b) => a + b, 0);
  if (totalLam - totalMu !== n) return false;
  const aStarts = lam.map((_, i) => (mu[i] ?? 0) + 1);
  return isColumnReduced(aStarts, lam);
}

export const entries: NumberKernel[] = [
  {
    head: "SkewPartitions",
    paramCount: 1,
    kind: "blocks",
    count: ([n]) => skewPart.count(String(n)),
    unrank: ([n], r) => SkewPartitionsUnrank(n, r),
    valid: (e, [n]) => IsSkewPartitionOf(e, n),
    rank: (e, [n]) => SkewPartitionsRank(e as [number[], number[]], n),
    declared: {
      carrier: "SkewPartition",
      params: [axis("size")],
      cost: enumerated("enumerative"),
      work: ([n]) => 4n ** BigInt(n),
    },
  },
];
