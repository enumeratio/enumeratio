import { expect, test } from "vite-plus/test";
import { entries } from "../src/families/partitions.ts";
import {
  PartitionsInBoxCount,
  PartitionsInBoxUnrank,
  PartitionsMaxPartCount,
  PartitionsMaxPartUnrank,
} from "../src/families/kernels-extra.ts";
import { entries as coreEntries } from "../src/families/core.ts";

// Certify every partition family: rank(unrank(p, r), p) === r across the whole family,
// unranked elements are valid members, and count matches the enumeration — same recipe as
// compositions.test.ts.
const PARAMS: Record<string, number[][]> = {
  OddPartitions: Array.from({ length: 16 }, (_, n) => [n]),
  PrimePartitions: Array.from({ length: 16 }, (_, n) => [n]),
  SquarePartitions: Array.from({ length: 16 }, (_, n) => [n]),
  TriangularPartitions: Array.from({ length: 16 }, (_, n) => [n]),
  LargestPartPartitions: Array.from({ length: 9 }, (_, n) => Array.from({ length: n + 1 }, (_, m) => [n, m])).flat(),
};

for (const entry of entries) {
  for (const p of PARAMS[entry.head] ?? [[6]]) {
    test(`${entry.head}(${p.join(", ")}) round-trips`, () => {
      const total = entry.count(p);
      for (let r = 0; r < total; r++) {
        const element = entry.unrank(p, r);
        expect(entry.valid(element, p)).toBe(true);
        expect(entry.rank(element, p)).toBe(r);
      }
    });
  }
}

// ─── brute force: enumerate all partitions of n, filter independently, compare as SETS ──────────
function allPartitions(n: number): number[][] {
  const out: number[][] = [];
  const acc: number[] = [];
  (function rec(remaining: number, max: number) {
    if (remaining === 0) {
      out.push(acc.slice());
      return;
    }
    for (let p = Math.min(remaining, max); p >= 1; p--) {
      acc.push(p);
      rec(remaining - p, p);
      acc.pop();
    }
  })(n, n);
  return out;
}

function isSquare(x: number): boolean {
  const r = Math.round(Math.sqrt(x));
  return r * r === x;
}
function isTriangular(x: number): boolean {
  const t = Math.round((Math.sqrt(8 * x + 1) - 1) / 2);
  return (t * (t + 1)) / 2 === x;
}
function isPrime(x: number): boolean {
  if (x < 2) return false;
  for (let d = 2; d * d <= x; d++) if (x % d === 0) return false;
  return true;
}

// Independent (brute-force-side) predicates — deliberately not sharing code with the kernels.
const PREDICATES: Record<string, (parts: number[]) => boolean> = {
  OddPartitions: (p) => p.every((x) => x % 2 === 1),
  PrimePartitions: (p) => p.every(isPrime),
  SquarePartitions: (p) => p.every(isSquare),
  TriangularPartitions: (p) => p.every(isTriangular),
};

const byHead = Object.fromEntries(entries.map((e) => [e.head, e]));
const asSet = (elements: number[][]) => new Set(elements.map((e) => JSON.stringify(e)));

for (let n = 0; n <= 20; n++) {
  const all = allPartitions(n);
  for (const [head, pred] of Object.entries(PREDICATES)) {
    test(`${head}(${n}) matches an independent brute-force predicate`, () => {
      const entry = byHead[head];
      const total = entry.count([n]);
      const kernelElements = Array.from({ length: total }, (_, r) => entry.unrank([n], r) as number[]);
      expect(asSet(kernelElements)).toEqual(asSet(all.filter(pred)));
      expect(kernelElements.length).toBe(total); // no duplicates snuck in
    });
  }
  for (let m = 1; m <= Math.max(n, 1); m++) {
    test(`LargestPartPartitions(${n}, ${m}) matches an independent brute-force predicate`, () => {
      const entry = byHead.LargestPartPartitions;
      const total = entry.count([n, m]);
      const kernelElements = Array.from({ length: total }, (_, r) => entry.unrank([n, m], r) as number[]);
      const expected = all.filter((p) => p.length > 0 && p[0] === m);
      expect(asSet(kernelElements)).toEqual(asSet(expected));
      expect(kernelElements.length).toBe(total);
    });
  }
}

// ─── BoundedPartPartitions (= PartitionsMaxPart) and BoxConfinedPartitions (= PartitionsInBox): ─
// catalogued as their own names but declared under these existing kernels (see partitions.ts's
// header and each one's own "Catalogued as an alias of ..." summary) — no kernel of their own,
// so certified against the
// kernel they alias rather than duplicated here.
for (let n = 0; n <= 20; n++) {
  const all = allPartitions(n);
  for (let k = 1; k <= 5; k++) {
    test(`BoundedPartPartitions(${n}, ${k}) [PartitionsMaxPart] matches an independent brute-force predicate`, () => {
      const total = PartitionsMaxPartCount(n, k);
      const elements = Array.from({ length: total }, (_, r) => PartitionsMaxPartUnrank(n, k, r));
      expect(asSet(elements)).toEqual(asSet(all.filter((p) => p.every((x) => x <= k))));
      expect(elements.length).toBe(total);
    });
  }
}
for (let a = 0; a <= 5; a++) {
  for (let b = 0; b <= 5; b++) {
    test(`BoxConfinedPartitions(${a}, ${b}) [PartitionsInBox] matches an independent brute-force predicate`, () => {
      // BoxConfinedPartitions is unbounded (all sizes) — enumerate every partition with
      // ≤ a parts, each ≤ b, independently, by trying every size up to the box's own max sum.
      const maxSum = a * b;
      const expected: number[][] = [];
      for (let n = 0; n <= maxSum; n++) {
        for (const p of allPartitions(n)) if (p.length <= a && p.every((x) => x <= b)) expected.push(p);
      }
      const total = PartitionsInBoxCount(a, b);
      const elements = Array.from({ length: total }, (_, r) => PartitionsInBoxUnrank(a, b, r));
      expect(asSet(elements)).toEqual(asSet(expected));
      expect(elements.length).toBe(total);
    });
  }
}

// ─── OEIS counts, independent of the round-trip above ───────────────────────────────────────────
const countsOf = (head: string, ps: number[][]) => ps.map((p) => byHead[head].count(p));
const range = (n: number) => Array.from({ length: n }, (_, i) => [i]);

test("OddPartitions count = A000009, and equals DistinctPartitions (Euler)", () => {
  const oddCounts = countsOf("OddPartitions", range(21));
  expect(oddCounts).toEqual([1, 1, 1, 2, 2, 3, 4, 5, 6, 8, 10, 12, 15, 18, 22, 27, 32, 38, 46, 54, 64]);
  const distinctPartitions = coreEntries.find((e) => e.head === "DistinctPartitions");
  expect(distinctPartitions).toBeDefined();
  expect(oddCounts).toEqual(range(21).map((p) => distinctPartitions?.count(p)));
});
test("PrimePartitions count = A000607", () => {
  expect(countsOf("PrimePartitions", range(21))).toEqual([
    1, 0, 1, 1, 1, 2, 2, 3, 3, 4, 5, 6, 7, 9, 10, 12, 14, 17, 19, 23, 26,
  ]);
});
test("SquarePartitions count = A001156", () => {
  expect(countsOf("SquarePartitions", range(21))).toEqual([
    1, 1, 1, 1, 2, 2, 2, 2, 3, 4, 4, 4, 5, 6, 6, 6, 8, 9, 10, 10, 12,
  ]);
});
test("TriangularPartitions count = A007294", () => {
  expect(countsOf("TriangularPartitions", range(21))).toEqual([
    1, 1, 1, 2, 2, 2, 4, 4, 4, 6, 7, 7, 10, 11, 11, 15, 17, 17, 22, 24, 25,
  ]);
});
