import { expect, test } from "vite-plus/test";
import { entries } from "../src/families/compositions.ts";

// Certify every composition family: rank(unrank(p, r), p) === r across the whole family,
// unranked elements are valid members, and count matches the enumeration — same recipe as
// permutations.test.ts.
const PARAMS: Record<string, number[][]> = {
  OddCompositions: Array.from({ length: 11 }, (_, n) => [n]),
  ProperCompositions: Array.from({ length: 11 }, (_, n) => [n]),
  DyadicCompositions: Array.from({ length: 11 }, (_, n) => [n]),
  FibonacciCompositions: Array.from({ length: 11 }, (_, n) => [n]),
  TriCompositions: Array.from({ length: 11 }, (_, n) => [n]),
  TetraCompositions: Array.from({ length: 11 }, (_, n) => [n]),
  TriangularCompositions: Array.from({ length: 11 }, (_, n) => [n]),
  PrimeCompositions: Array.from({ length: 11 }, (_, n) => [n]),
  CarlitzCompositions: Array.from({ length: 11 }, (_, n) => [n]),
  PalindromicCompositions: Array.from({ length: 11 }, (_, n) => [n]),
  ZigzagCompositions: Array.from({ length: 11 }, (_, n) => [n]),
  KBoundedCompositions: [1, 2, 3, 4].flatMap((k) => Array.from({ length: 9 }, (_, n) => [n, k])),
};

for (const entry of entries) {
  for (const p of PARAMS[entry.head] ?? [[3]]) {
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

// ─── brute force: enumerate all compositions of n, filter independently, compare as SETS ───────
function allCompositions(n: number): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  const acc: number[] = [];
  (function rec(remaining: number) {
    if (remaining === 0) {
      out.push(acc.slice());
      return;
    }
    for (let p = 1; p <= remaining; p++) {
      acc.push(p);
      rec(remaining - p);
      acc.pop();
    }
  })(n);
  return out;
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
  OddCompositions: (p) => p.every((x) => x % 2 === 1),
  ProperCompositions: (p) => p.every((x) => x >= 2),
  DyadicCompositions: (p) => p.every((x) => (x & (x - 1)) === 0),
  FibonacciCompositions: (p) => p.every((x) => x === 1 || x === 2),
  TriCompositions: (p) => p.every((x) => x >= 1 && x <= 3),
  TetraCompositions: (p) => p.every((x) => x >= 1 && x <= 4),
  TriangularCompositions: (p) => p.every(isTriangular),
  PrimeCompositions: (p) => p.every(isPrime),
  CarlitzCompositions: (p) => p.every((x, i) => i === 0 || p[i - 1] !== x),
  PalindromicCompositions: (p) => p.every((x, i) => x === p[p.length - 1 - i]),
  ZigzagCompositions: (p) => {
    if (p.length <= 1) return true;
    let expected: "up" | "down" | null = null;
    for (let i = 0; i + 1 < p.length; i++) {
      if (p[i] === p[i + 1]) return false;
      const rel = p[i] < p[i + 1] ? "up" : "down";
      if (expected !== null && rel !== expected) return false;
      expected = rel === "up" ? "down" : "up";
    }
    return true;
  },
};

const byHead = Object.fromEntries(entries.map((e) => [e.head, e]));
const asSet = (elements: number[][]) => new Set(elements.map((e) => JSON.stringify(e)));

for (let n = 0; n <= 12; n++) {
  const all = allCompositions(n);
  for (const [head, pred] of Object.entries(PREDICATES)) {
    test(`${head}(${n}) matches an independent brute-force predicate`, () => {
      const entry = byHead[head];
      const total = entry.count([n]);
      const kernelElements = Array.from({ length: total }, (_, r) => entry.unrank([n], r) as number[]);
      expect(asSet(kernelElements)).toEqual(asSet(all.filter(pred)));
      expect(kernelElements.length).toBe(total); // no duplicates snuck in
    });
  }
  for (const k of [1, 2, 3, 4]) {
    test(`KBoundedCompositions(${n}, ${k}) matches an independent brute-force predicate`, () => {
      const entry = byHead.KBoundedCompositions;
      const total = entry.count([n, k]);
      const kernelElements = Array.from({ length: total }, (_, r) => entry.unrank([n, k], r) as number[]);
      expect(asSet(kernelElements)).toEqual(asSet(all.filter((p) => p.every((x) => x <= k))));
      expect(kernelElements.length).toBe(total);
    });
  }
}

// ─── OEIS counts, independent of the round-trip above ───────────────────────────────────────────
const countsOf = (head: string, ps: number[][]) => ps.map((p) => byHead[head].count(p));
const range = (n: number) => Array.from({ length: n }, (_, i) => [i]);

test("OddCompositions count = A000045 (Fibonacci)", () => {
  expect(countsOf("OddCompositions", range(13))).toEqual([1, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144]);
});
test("ProperCompositions count = shifted Fibonacci", () => {
  expect(countsOf("ProperCompositions", range(13))).toEqual([1, 0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89]);
});
test("FibonacciCompositions count = F(n+1)", () => {
  expect(countsOf("FibonacciCompositions", range(13))).toEqual([1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233]);
});
test("TriCompositions count = tribonacci (A000073)", () => {
  expect(countsOf("TriCompositions", range(13))).toEqual([1, 1, 2, 4, 7, 13, 24, 44, 81, 149, 274, 504, 927]);
});
test("TetraCompositions count = tetranacci (A000078)", () => {
  expect(countsOf("TetraCompositions", range(13))).toEqual([1, 1, 2, 4, 8, 15, 29, 56, 108, 208, 401, 773, 1490]);
});
test("DyadicCompositions count = A023359", () => {
  expect(countsOf("DyadicCompositions", range(13))).toEqual([1, 1, 2, 3, 6, 10, 18, 31, 56, 98, 174, 306, 542]);
});
test("PrimeCompositions count = A023360", () => {
  expect(countsOf("PrimeCompositions", range(13))).toEqual([1, 0, 1, 1, 1, 3, 2, 6, 6, 10, 16, 20, 35]);
});
test("TriangularCompositions count = A023361", () => {
  expect(countsOf("TriangularCompositions", range(13))).toEqual([1, 1, 1, 2, 3, 4, 7, 11, 16, 25, 40, 61, 94]);
});
test("CarlitzCompositions count = A003242", () => {
  expect(countsOf("CarlitzCompositions", range(13))).toEqual([1, 1, 1, 3, 4, 7, 14, 23, 39, 71, 124, 214, 378]);
});
test("PalindromicCompositions count = A016116 (2^floor(n/2))", () => {
  expect(countsOf("PalindromicCompositions", range(13))).toEqual([1, 1, 2, 2, 4, 4, 8, 8, 16, 16, 32, 32, 64]);
});
test("ZigzagCompositions count = A025047", () => {
  expect(countsOf("ZigzagCompositions", range(13))).toEqual([1, 1, 1, 3, 4, 7, 12, 19, 29, 48, 75, 118, 186]);
});
test("KBoundedCompositions row k = generalized k-nacci", () => {
  // k=1: only the all-ones composition, one per n.
  expect(
    countsOf(
      "KBoundedCompositions",
      Array.from({ length: 8 }, (_, n) => [n, 1]),
    ),
  ).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
  // k=2: same recurrence as FibonacciCompositions (parts 1..2 IS parts in {1,2}).
  expect(
    countsOf(
      "KBoundedCompositions",
      Array.from({ length: 8 }, (_, n) => [n, 2]),
    ),
  ).toEqual(countsOf("FibonacciCompositions", range(8)));
  // k=3: same recurrence as TriCompositions.
  expect(
    countsOf(
      "KBoundedCompositions",
      Array.from({ length: 8 }, (_, n) => [n, 3]),
    ),
  ).toEqual(countsOf("TriCompositions", range(8)));
  // k=4: same recurrence as TetraCompositions.
  expect(
    countsOf(
      "KBoundedCompositions",
      Array.from({ length: 8 }, (_, n) => [n, 4]),
    ),
  ).toEqual(countsOf("TetraCompositions", range(8)));
});
