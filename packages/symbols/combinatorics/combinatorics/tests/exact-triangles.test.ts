// The exact counts of collections/src/families/exact-triangles.ts, past 2^53 where the interpreter takes
// minutes (tests/fast-kernels.test.ts holds them to Epsil where it is quick): each is held to a
// second route to the same number, the formula or the direct recursion the family is named for.

import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { integerOf, isEpsilFamily, kernelOn } from "../collections/src/families/epsil.ts";
import { allFamilies } from "../collections/src/families/index.ts";
import { declareCombinatorics } from "../src/index.ts";

const ce = bareEngine();
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

const countOf = (head: string, p: number[]): bigint => {
  const family = allFamilies.find((f) => f.head === head)!;
  expect(isEpsilFamily(family)).toBe(true);
  return kernelOn(ce, family).count(p) as bigint;
};

const binomial = (n: number, k: number): bigint => {
  let result = 1n;
  for (let i = 1; i <= k; i++) result = (result * BigInt(n - k + i)) / BigInt(i);
  return result;
};

/** Eulerian numbers by the alternating sum Σ (−1)^i C(n + 1, i) (k + 1 − i)^n. */
function eulerianBySum(n: number, k: number): bigint {
  if (n === 0) return k === 0 ? 1n : 0n;
  let total = 0n;
  for (let i = 0; i <= k; i++) total += (i % 2 === 0 ? 1n : -1n) * binomial(n + 1, i) * BigInt(k + 1 - i) ** BigInt(n);
  return total;
}

/** c(n, k) by the exponential formula: n! [xⁿ] (−ln(1 − x))ᵏ / k!, the series kept as n!ᵐ-scaled integers. */
function stirlingByLogSeries(n: number, k: number): bigint {
  if (k > n) return 0n;
  if (k === 0) return n === 0 ? 1n : 0n;
  let fact = 1n;
  for (let i = 2; i <= n; i++) fact *= BigInt(i);
  const log = [0n, ...Array.from({ length: n }, (_, i) => fact / BigInt(i + 1))]; // n!·xʲ/j
  let power = log;
  for (let m = 2; m <= k; m++) {
    const next = Array<bigint>(n + 1).fill(0n);
    for (let a = 1; a <= n; a++) for (let b = 1; a + b <= n; b++) next[a + b] += power[a] * log[b];
    power = next;
  }
  let kFact = 1n;
  for (let i = 2; i <= k; i++) kFact *= BigInt(i);
  const scaled = power[n] * fact;
  expect(scaled % (fact ** BigInt(k) * kFact)).toBe(0n);
  return scaled / (fact ** BigInt(k) * kFact);
}

/** The permutations of n with k cycles, counted one by one. */
function cyclesByEnumeration(n: number, k: number): bigint {
  let total = 0n;
  const used = Array<boolean>(n).fill(false);
  const image: number[] = [];
  const cycles = (): number => {
    const seen = Array<boolean>(n).fill(false);
    let count = 0;
    for (let s = 0; s < n; s++) {
      if (seen[s]) continue;
      count++;
      for (let at = s; !seen[at]; at = image[at]) seen[at] = true;
    }
    return count;
  };
  const place = (): void => {
    if (image.length === n) {
      if (cycles() === k) total++;
      return;
    }
    for (let v = 0; v < n; v++) {
      if (used[v]) continue;
      used[v] = true;
      image.push(v);
      place();
      image.pop();
      used[v] = false;
    }
  };
  place();
  return total;
}

/** The zigzag numbers by 2 E(n + 1) = Σ C(n, j) E(j) E(n − j). */
function zigzagByConvolution(n: number): bigint {
  const e = [1n, 1n];
  for (let m = 1; m < n; m++) {
    let sum = 0n;
    for (let j = 0; j <= m; j++) sum += binomial(m, j) * e[j] * e[m - j];
    e.push(sum / 2n);
  }
  return e[n];
}

/** Σ over the non-crossing partitions of Π (|B| − 1)!, as the fixed point of F = 1 + Σ (k − 1)! xᵏ Fᵏ. */
function nonCrossingCycleSupportByFixedPoint(n: number): bigint {
  const multiply = (a: bigint[], b: bigint[]): bigint[] => {
    const out = Array<bigint>(n + 1).fill(0n);
    for (let i = 0; i <= n; i++) if (a[i] !== 0n) for (let j = 0; i + j <= n; j++) out[i + j] += a[i] * b[j];
    return out;
  };
  let f = [1n, ...Array<bigint>(n).fill(0n)];
  for (let round = 0; round < n; round++) {
    const next = [1n, ...Array<bigint>(n).fill(0n)];
    let power = f;
    let weight = 1n; // (k − 1)!
    for (let k = 1; k <= n; k++) {
      for (let d = 0; d + k <= n; d++) next[d + k] += weight * power[d];
      power = multiply(power, f);
      weight *= BigInt(k);
    }
    f = next;
  }
  return f[n];
}

/** Motzkin paths of length n with k peaks, step by step over (height, last step up, peaks). */
function motzkinPeaksBySteps(n: number, k: number): bigint {
  let states = new Map<string, bigint>([["0,0,0", 1n]]);
  for (let step = 0; step < n; step++) {
    const next = new Map<string, bigint>();
    const add = (h: number, up: number, peaks: number, count: bigint): void => {
      if (h < 0 || peaks > k) return;
      const key = `${h},${up},${peaks}`;
      next.set(key, (next.get(key) ?? 0n) + count);
    };
    for (const [key, count] of states) {
      const [h, up, peaks] = key.split(",").map(Number);
      add(h + 1, 1, peaks, count);
      add(h, 0, peaks, count);
      if (h > 0) add(h - 1, 0, peaks + up, count);
    }
    states = next;
  }
  return states.get(`0,0,${k}`) ?? 0n;
}

test("Euler zigzag numbers, past 2^53 too", () => {
  for (const n of [0, 1, 2, 3, 10, 22, 30, 60, 100])
    expect([n, countOf("AlternatingPermutations", [n])]).toEqual([n, zigzagByConvolution(n)]);
  expect(countOf("AlternatingPermutations", [30])).toBe(441543893249023104553682821n);
  expect(zigzagByConvolution(22) > MAX_SAFE).toBe(true);
});

test("Eulerian numbers, past 2^53 too", () => {
  for (const p of [
    [0, 0],
    [1, 0],
    [3, 5],
    [19, 9],
    [25, 12],
    [54, 1],
    [40, 17],
    [40, 39],
    [100, 30],
    [150, 140],
  ])
    expect([p, countOf("KDescentPermutations", p)]).toEqual([p, eulerianBySum(p[0], p[1])]);
  expect(eulerianBySum(19, 9) > MAX_SAFE).toBe(true);
});

test("unsigned Stirling numbers of the first kind, past 2^53 too", () => {
  for (let n = 0; n <= 7; n++)
    for (let k = 0; k <= 8; k++)
      expect([n, k, countOf("KCyclePermutations", [n, k])]).toEqual([n, k, cyclesByEnumeration(n, k)]);
  for (const p of [
    [8, 3],
    [19, 5],
    [25, 10],
    [60, 30],
    [100, 5],
  ])
    expect([p, countOf("KCyclePermutations", p)]).toEqual([p, stirlingByLogSeries(p[0], p[1])]);
  // The ends of a row have closed forms: (n − 1)! and C(n, 2).
  let factorial = 1n;
  for (let n = 2; n <= 300; n++) factorial *= BigInt(n - 1);
  expect(countOf("KCyclePermutations", [300, 1])).toBe(factorial);
  expect(countOf("KCyclePermutations", [300, 299])).toBe(binomial(300, 2));
  expect(stirlingByLogSeries(19, 5) > MAX_SAFE).toBe(true);
});

test("non-crossing cycle supports, past 2^53 too", () => {
  for (const n of [0, 1, 2, 3, 4, 19, 25, 40, 60])
    expect([n, countOf("NonCrossingCycleSupportPermutations", [n])]).toEqual([
      n,
      nonCrossingCycleSupportByFixedPoint(n),
    ]);
  expect(nonCrossingCycleSupportByFixedPoint(19) > MAX_SAFE).toBe(true);
});

/** The involutions of n by their pairs: Σₖ n! / ((n − 2k)! k! 2ᵏ). */
function involutionsByPairs(n: number): bigint {
  const fact = [1n];
  for (let i = 1; i <= n; i++) fact.push(fact[i - 1] * BigInt(i));
  let total = 0n;
  for (let k = 0; 2 * k <= n; k++) total += fact[n] / (fact[n - 2 * k] * fact[k] * 2n ** BigInt(k));
  return total;
}

test("involutions (telephone numbers), past 2^53 and past the doubles' range too", () => {
  for (const n of [0, 1, 2, 3, 10, 23, 27, 28, 40, 100, 300, 400, 1000, 5000])
    expect([n, countOf("Involutions", [n])]).toEqual([n, involutionsByPairs(n)]);
  expect(involutionsByPairs(28) > MAX_SAFE && involutionsByPairs(27) <= MAX_SAFE).toBe(true);
});

/** The Mahonian numbers of n: the coefficients of the q-factorial Π (1 + q + … + qʲ), j < n. */
function mahonianByQFactorial(n: number): bigint[] {
  let poly = [1n];
  for (let j = 1; j < n; j++) {
    const next = Array<bigint>(poly.length + j).fill(0n);
    for (let d = 0; d <= j; d++) poly.forEach((c, i) => (next[i + d] += c));
    poly = next;
  }
  return poly;
}

test("permutations by inversions (Mahonian numbers), past 2^53 too", () => {
  for (const [n, k] of [
    [0, 0],
    [5, 4],
    [20, 95],
    [20, 190],
    [25, 100],
    [40, 390],
    [60, 885],
  ])
    expect([n, k, countOf("KInversionPermutations", [n, k])]).toEqual([n, k, mahonianByQFactorial(n)[k]]);
  expect(mahonianByQFactorial(20)[95] > MAX_SAFE && mahonianByQFactorial(19)[85] <= MAX_SAFE).toBe(true);
});

test("Motzkin paths by peaks, past 2^53 too", () => {
  for (let n = 0; n <= 12; n++)
    for (let k = 0; k <= 7; k++)
      expect([n, k, countOf("MotzkinPathsByPeaks", [n, k])]).toEqual([n, k, motzkinPeaksBySteps(n, k)]);
  for (const p of [
    [44, 10],
    [50, 10],
    [60, 20],
    [80, 0],
    [100, 25],
    [100, 50],
  ])
    expect([p, countOf("MotzkinPathsByPeaks", p)]).toEqual([p, motzkinPeaksBySteps(p[0], p[1])]);
  expect(motzkinPeaksBySteps(44, 10) > MAX_SAFE).toBe(true);
});

// Each family's bound on its first param, and a member of the fiber at n with k.
const iota = (n: number): number[] => Array.from({ length: n }, (_, i) => i + 1);
const BOUNDED: { head: string; limit: number; params: (n: number) => number[]; member: (n: number) => number[] }[] = [
  {
    head: "KCyclePermutations",
    limit: 1000,
    params: (n) => [n, 5],
    // One cycle of n − 4 elements, and 4 fixed points.
    member: (n) => [...iota(n - 4).map((v) => (v === n - 4 ? 1 : v + 1)), ...iota(4).map((v) => n - 4 + v)],
  },
  {
    head: "KDescentPermutations",
    limit: 1000,
    params: (n) => [n, 5],
    // The first six reversed, then ascending: 5 descents.
    member: (n) => [6, 5, 4, 3, 2, 1, ...iota(n - 6).map((v) => v + 6)],
  },
  {
    head: "AlternatingPermutations",
    limit: 1000,
    params: (n) => [n],
    member: (n) => {
      const x = [1];
      for (let j = 2; j < n; j += 2) x.push(j + 1, j);
      if (n % 2 === 0) x.push(n);
      return x;
    },
  },
  { head: "NonCrossingCycleSupportPermutations", limit: 600, params: (n) => [n], member: iota },
  { head: "Involutions", limit: 5000, params: (n) => [n], member: iota },
  { head: "SeparablePermutations", limit: 10_000, params: (n) => [n], member: iota },
  { head: "VexillaryPermutations", limit: 10_000, params: (n) => [n], member: iota },
  { head: "ConnectedPermutations", limit: 600, params: (n) => [n], member: (n) => iota(n).toReversed() },
  {
    head: "MotzkinPathsByPeaks",
    limit: 600,
    params: (n) => [n, 5],
    member: (n) => [...Array.from({ length: 5 }, () => [1, -1]).flat(), ...Array<number>(n - 10).fill(0)],
  },
];

/** "declined" where the kernel answers unknown (a RangeError), else its answer. */
const declined = (f: () => unknown): unknown => {
  try {
    return f();
  } catch (error) {
    if (error instanceof RangeError) return "declined";
    throw error;
  }
};

for (const { head, limit, params, member } of BOUNDED) {
  test(`${head}: exact at its bound, and at limit + 1 Count, At and rank decline at once`, () => {
    const engine = bareEngine();
    declareCombinatorics(engine);
    const run = (expr: unknown): unknown => engine.box(expr as never).evaluate().json;
    const fast = (what: string, f: () => unknown): unknown => {
      const start = performance.now();
      const out = f();
      expect([what, performance.now() - start < 1500]).toEqual([what, true]);
      return out;
    };
    const kernel = kernelOn(
      ce,
      allFamilies.find((f) => f.head === head)!,
    );
    for (const n of [limit, limit + 1]) {
      const p = params(n);
      const call = [head, ...p];
      const x = member(n);
      // Membership never reads the count: it answers at any size.
      expect(fast("Element", () => run(["Element", ["List", ...x], call]))).toBe("True");
      if (n === limit) {
        const total = fast("Count", () => run(["Count", call]));
        expect(typeof integerOf(total)).toBe("bigint");
        expect(integerOf(total)! > MAX_SAFE).toBe(true);
      } else {
        expect(fast("Count", () => run(["Count", call]))).toEqual(["Count", call]);
        expect(() => kernel.count(p)).toThrow(RangeError);
      }
      // Past 2^53 the first member, and the place of a member, are unknown rather than slow.
      const at = fast("At", () => run(["At", call, 1]));
      expect(at === "Missing" || (Array.isArray(at) && at[0] === "At")).toBe(true);
      expect(fast("unrank", () => declined(() => kernel.unrank(p, 0n)))).toBe("declined");
      expect(fast("rank", () => declined(() => kernel.rank(x, p)))).toBe("declined");
    }
  });
}

test("an element of a Motzkin fiber a double counts, however long the path, is found at once", () => {
  const engine = bareEngine();
  declareCombinatorics(engine);
  const kernel = kernelOn(
    ce,
    allFamilies.find((f) => f.head === "MotzkinPathsByPeaks")!,
  );
  for (const p of [
    [200, 96],
    [400, 197],
    [600, 297],
  ]) {
    const total = kernel.count(p) as bigint;
    expect(total <= MAX_SAFE).toBe(true);
    const start = performance.now();
    for (const r of [0n, total / 2n, total - 1n]) {
      const path = kernel.unrank(p, r);
      expect([p, r, kernel.rank(path, p)]).toEqual([p, r, r]);
    }
    expect(performance.now() - start).toBeLessThan(3000);
    const at = engine.box(["At", ["MotzkinPathsByPeaks", ...p], 1] as never).evaluate().json;
    expect(Array.isArray(at) && at[0]).toBe("MotzkinPath");
  }
  // A fiber of a large count is refused, not worked on until the memory is gone.
  const start = performance.now();
  expect(() => kernel.unrank([400, 5], 3n)).toThrow(RangeError);
  expect(performance.now() - start).toBeLessThan(3000);
});

test("past its limit a family answers unknown at once, never a hang", () => {
  const engine = bareEngine();
  declareCombinatorics(engine);
  const count = (head: string, ...p: number[]): unknown => engine.box(["Count", [head, ...p]] as never).evaluate().json;
  for (const [head, ...p] of [
    ["KCyclePermutations", 5000, 5],
    ["KDescentPermutations", 5000, 5],
    ["AlternatingPermutations", 5000],
    ["NonCrossingCycleSupportPermutations", 1000],
    ["MotzkinPathsByPeaks", 1000, 5],
  ] as [string, ...number[]][])
    expect(count(head, ...p)).toEqual(["Count", [head, ...p]]);
  // Within it, the exact integer.
  expect(integerOf(count("KCyclePermutations", 100, 5))).toBe(stirlingByLogSeries(100, 5));
});

test("the fibers that are 0 or 1 whatever the size are answered past the bound", () => {
  expect([
    countOf("KCyclePermutations", [5000, 5000]),
    countOf("KCyclePermutations", [5000, 0]),
    countOf("KCyclePermutations", [5000, 5001]),
    countOf("KDescentPermutations", [5000, 0]),
    countOf("KDescentPermutations", [5000, 4999]),
    countOf("KDescentPermutations", [5000, 5000]),
    countOf("MotzkinPathsByPeaks", [5000, 2501]),
    countOf("KCyclePermutations", [5000, 4999]),
    countOf("KCyclePermutations", [2, 1]),
    countOf("KCyclePermutations", [1, 0]),
  ]).toEqual([1n, 0n, 0n, 1n, 1n, 0n, 0n, 12_497_500n, 1n, 0n]);
});

test("malformed params keep the interpreter's answer", () => {
  // Not through the engine, whose types refuse them: the kernel is asked directly.
  const family = allFamilies.find((f) => f.head === "KCyclePermutations")!;
  const kernel = kernelOn(ce, family);
  expect(kernel.count([-1, 2])).toBe(0n);
  expect(kernel.count([2.5, 1])).toBeNaN();
});
