// SkewPartitions defined in Epsil: against the order the TS kernel listed (a frozen record, dumped
// from it before it was replaced), an independent filter of every pair of partitions, and exact
// counts. The fast path (plain numbers) is held to the same.

import { readFileSync } from "node:fs";
import { collectMessages } from "@enumeratio/engine";
import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { epsilKernelOn, kernelOn } from "../../collections/src/families/epsil.ts";
import { declareCombinatorics } from "../../src/index.ts";
import { entries } from "../src/families/skew-partitions.ts";

const [family] = entries;
const ce = bareEngine();
const epsil = epsilKernelOn(ce, family);
const fast = kernelOn(ce, family);

// A frozen record of the order the family had as a TS kernel (λ/μ, each a comma list), for n ≤ 8; the filter below
// and the counts cover more. It is not regenerated: the Epsil must list the shapes in it, member by member.
const OLD = JSON.parse(readFileSync(new URL("./golden/old-skew-partitions.json", import.meta.url), "utf8")) as Record<
  string,
  string[]
>;
const parse = (shape: string): [number[], number[]] => {
  const [lam, mu] = shape.split("/").map((part) => (part === "" ? [] : part.split(",").map(Number)));
  return [lam, mu];
};
const written = (element: unknown): string => {
  const [lam, mu] = element as number[][];
  return `${lam.join(",")}/${mu.join(",")}`;
};

for (const kernel of [epsil, fast]) {
  const name = kernel === epsil ? "Epsil" : "the fast path";
  test(`${name} lists the shapes in the order the TS kernel did, and rank and unrank invert`, () => {
    const sizes = Object.keys(OLD).map(Number);
    expect(sizes.length).toBe(9);
    for (const n of sizes) {
      expect([n, kernel.count([n])]).toEqual([n, BigInt(OLD[n].length)]);
      OLD[n].forEach((shape, r) => {
        const member = parse(shape);
        expect([n, r, written(kernel.unrank([n], BigInt(r)))]).toEqual([n, r, shape]);
        expect([n, r, kernel.rank(member, [n])]).toEqual([n, r, BigInt(r)]);
        expect([n, shape, kernel.valid(member, [n])]).toEqual([n, shape, true]);
      });
    }
  });
}

/** Whether [lam, mu] is a reduced skew shape of n cells, written independently of the family: μ has
 *  no zero part, and every row and every column up to λ₁ holds a cell. */
function isReducedSkew(lam: number[], mu: number[], n: number): boolean {
  if (mu.length > lam.length || mu.some((m) => m < 1)) return false;
  for (let i = 0; i < lam.length; i++) {
    if (lam[i] < 1 || (i > 0 && lam[i] > lam[i - 1])) return false;
    if (i > 0 && (mu[i] ?? 0) > (mu[i - 1] ?? 0)) return false;
    if ((mu[i] ?? 0) >= lam[i]) return false;
  }
  if (lam.reduce((a, b) => a + b, 0) - mu.reduce((a, b) => a + b, 0) !== n) return false;
  for (let col = 1; col <= (lam[0] ?? 0); col++)
    if (!lam.some((end, i) => (mu[i] ?? 0) + 1 <= col && col <= end)) return false;
  return true;
}

/** Every partition with at most `maxParts` parts, each at most `maxVal`. */
function partitions(maxParts: number, maxVal: number): number[][] {
  const out: number[][] = [[]];
  const grow = (prefix: number[]): void => {
    if (prefix.length === maxParts) return;
    for (let v = 1; v <= (prefix.at(-1) ?? maxVal); v++) {
      out.push([...prefix, v]);
      grow([...prefix, v]);
    }
  };
  grow([]);
  return out;
}

test("the shapes are every reduced skew shape, found by filtering every pair of partitions, n ≤ 4", () => {
  for (let n = 0; n <= 4; n++) {
    const candidates = partitions(n + 1, n + 1);
    const expected = new Set<string>();
    for (const lam of candidates)
      for (const mu of candidates) if (isReducedSkew(lam, mu, n)) expected.add(JSON.stringify([lam, mu]));
    const total = Number(epsil.count([n]));
    const got = new Set<string>();
    for (let r = 0; r < total; r++) got.add(JSON.stringify(epsil.unrank([n], BigInt(r))));
    expect(got).toEqual(expected);
    expect(total).toBe(expected.size);
  }
});

test("membership over every pair of partitions near the size, with zero parts added to μ", () => {
  let rejected = 0;
  let zeroed = 0;
  for (let n = 0; n <= 4; n++) {
    const candidates = partitions(n + 2, n + 1);
    for (const lam of candidates)
      for (const mu of candidates)
        for (const padded of [mu, [...mu, 0]]) {
          const want = isReducedSkew(lam, padded, n);
          for (const kernel of [epsil, fast])
            expect([n, lam, padded, kernel.valid([lam, padded], [n])]).toEqual([n, lam, padded, want]);
          if (!want) rejected++;
          if (!want && padded !== mu && isReducedSkew(lam, mu, n)) zeroed++;
        }
  }
  expect(rejected).toBeGreaterThan(1000);
  // A shape written with a trailing zero in μ is no member, though it names a member.
  expect(zeroed).toBeGreaterThan(10);
});

test("shapes that are no shape at all are not members", () => {
  for (const kernel of [epsil, fast])
    for (const bad of [
      [
        [2, 1],
        [1, 0],
      ],
      [[2, 1], [0]],
      [[1], [0]],
      [[2, 2], [2]],
      [[3, 1], [2]],
      [
        [2, 1, 1],
        [1, 1],
      ],
      [[1, 2], []],
      [[], [1]],
      [[1], [], []],
      [[1, 1], [-1]],
      [[0], []],
      [[2], [1, 1]],
    ])
      expect([bad, kernel.valid(bad, [3])]).toEqual([bad, false]);
  expect(epsil.valid([[], []], [0])).toBe(true);
  expect(epsil.valid([[], []], [1])).toBe(false);
});

test("the counts are exact", () => {
  expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((n) => epsil.count([n]))).toEqual(
    [1, 1, 3, 9, 28, 87, 272, 850, 2659, 8318, 26025, 81427, 254777, 797175].map(BigInt),
  );
  expect([10, 11, 12, 13].map((n) => fast.count([n]))).toEqual([26025n, 81427n, 254777n, 797175n]);
  expect(epsil.count([-3])).toBe(0n);
});

/** The count by the same recurrence in bigint: rows below [a, b] with c cells, summed over first rows. */
function counts(upTo: number): bigint[] {
  const out: bigint[] = [1n];
  for (let n = 1; n <= upTo; n++) {
    const t = new Map<string, bigint>();
    const below = (c: number, a: number, b: number): bigint => {
      const key = `${c},${a},${b}`;
      let found = t.get(key);
      if (found === undefined) {
        found = 0n;
        if (c === 0) found = a === 1 ? 1n : 0n;
        else
          for (let b2 = Math.max(a - 1, 1); b2 <= b; b2++)
            for (let a2 = 1; a2 <= Math.min(a, b2); a2++)
              if (b2 - a2 + 1 <= c) found += below(c - (b2 - a2 + 1), a2, b2);
        t.set(key, found);
      }
      return found;
    };
    let total = 0n;
    for (let b = 1; b <= n; b++) for (let a = 1; a <= b; a++) total += below(n - (b - a + 1), a, b);
    out.push(total);
  }
  return out;
}

test("a count a double holds is exact, up to 2^53; past it the count declines", () => {
  const expected = counts(36);
  const MAX = BigInt(Number.MAX_SAFE_INTEGER);
  for (let n = 10; n <= 36; n++) {
    if (n < 34) {
      expect(expected[n]).toBeLessThanOrEqual(MAX);
      expect([n, epsil.count([n])]).toEqual([n, expected[n]]);
      expect([n, fast.count([n])]).toEqual([n, expected[n]]);
    } else {
      expect(expected[n]).toBeGreaterThan(MAX);
      expect(() => epsil.count([n])).toThrow(RangeError);
      expect(() => fast.count([n])).toThrow(RangeError);
      expect(() => epsil.unrank([n], 0n)).toThrow(RangeError);
    }
  }
  // The counts only grow, so no count past 34 comes back under 2^53.
  expect(expected.every((count, n) => n < 2 || count > expected[n - 1])).toBe(true);
  // Past it only a small rank is the fast path's to answer, and not at a size whose table is out of reach.
  expect(fast.unrank([34], 0n)).toEqual([Array.from({ length: 34 }, () => 1), []]);
  for (const kernel of [epsil, fast]) {
    expect(() => kernel.count([5000])).toThrow(RangeError);
    expect(() => kernel.unrank([5000], 0n)).toThrow(RangeError);
  }
});

test("the first, middle and last shapes of a large fiber round-trip", () => {
  for (const n of [20, 28, 33]) {
    const total = epsil.count([n]) as bigint;
    for (const r of [0n, 1n, total / 3n, total / 2n, total - 2n, total - 1n]) {
      const shape = epsil.unrank([n], r);
      expect(epsil.valid(shape, [n])).toBe(true);
      expect(epsil.rank(shape, [n])).toBe(r);
      expect(fast.unrank([n], r)).toEqual(shape);
    }
  }
  // A rank outside the fiber is none.
  expect(() => epsil.unrank([5], 87n)).toThrow(RangeError);
  expect(() => epsil.unrank([5], -1n)).toThrow(RangeError);
});

test("through the engine: an element comes out, Element asks membership, and a call past the limit is refused", () => {
  const engine = bareEngine();
  declareCombinatorics(engine);
  const run = (expr: unknown) => {
    const { value, messages } = collectMessages(engine, () => engine.box(expr as never).evaluate());
    return { json: value.json, texts: messages.map((m) => (m as { text?: string }).text ?? "") };
  };
  expect(run(["At", ["SkewPartitions", 3], 7]).json).toEqual(["List", ["List", 3, 1], ["List", 1]]);
  const element = (x: unknown, n: number) => run(["Element", x, ["SkewPartitions", n]]).json;
  expect(element(["List", ["List", 3, 1], ["List", 1]], 3)).toBe("True");
  // The hole a TS kernel left: μ = (1, 0) names the shape (2, 1)/(1) but was never listed.
  expect(element(["List", ["List", 2, 1], ["List", 1, 0]], 2)).toBe("False");
  expect(element(["List", ["List", 2, 1], ["List", 1]], 2)).toBe("True");
  expect(element(["List", ["List", 2, 2], ["List", 1]], 4)).toBe("False");
  expect(run(["Count", ["SkewPartitions", 12]]).json).toBe(254777);
  // A walk answers far past what could be enumerated, up to the last size with a count.
  for (const n of [25, 33]) expect(Array.isArray(run(["At", ["SkewPartitions", n], 12345678]).json)).toBe(true);
  // Past that, the count is unknown, and a call is refused for its steps, before any table is built.
  expect(run(["Count", ["SkewPartitions", 34]]).json).toEqual(["Count", ["SkewPartitions", 34]]);
  const refused = run(["At", ["SkewPartitions", 40], 1]);
  expect(refused.texts.join(" ")).toContain("SkewPartitions(40) would take about 5,120,000 steps");
  expect(refused.json).toBe("Missing");
});
