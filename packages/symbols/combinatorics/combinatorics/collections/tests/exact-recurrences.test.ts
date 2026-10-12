import { expect, test } from "vite-plus/test";
import {
  bellExact,
  booleanPermutationsExact,
  dyadicCompositionsExact,
  dyckPathsByHeightExact,
  fineExact,
  fibonacciExact,
  fibonacciWordsExact,
  fubiniExact,
  motzkinExact,
  oddCompositionsExact,
  primeCompositionsExact,
  properCompositionsExact,
  riordanExact,
  schroederExact,
  semistandardTableauxExact,
  shiftedStandardTableauxExact,
  stirlingSecondExact,
  surjectionsExact,
  triangularCompositionsExact,
  triStringsExact,
  windowSumsExact,
  RECURRENCE_TOP,
} from "../src/families/exact-recurrences.ts";

// Each is held to a different computation here (a convolution, a transform, a plain DP over the
// definition's states); tests/fast-kernels.test.ts holds them to Epsil.

const binomial = (n: number, k: number): bigint => {
  let result = 1n;
  for (let i = 1; i <= k; i++) result = (result * BigInt(n - k + i)) / BigInt(i);
  return result;
};
const factorial = (n: number): bigint => (n <= 1 ? 1n : BigInt(n) * factorial(n - 1));
const range = (to: number): number[] => Array.from({ length: to + 1 }, (_, i) => i);

/** Compositions of n with every part passing `allows`, by the textbook recurrence over the predicate. */
function compositions(n: number, allows: (p: number) => boolean): bigint {
  const c = [1n];
  for (let m = 1; m <= n; m++) {
    let total = 0n;
    for (let p = 1; p <= m; p++) if (allows(p)) total += c[m - p];
    c.push(total);
  }
  return c[n];
}

const motzkinByHeights = (n: number): bigint => {
  let row: bigint[] = Array(n + 2).fill(0n);
  row[0] = 1n;
  for (let step = 0; step < n; step++) {
    const next: bigint[] = Array(n + 2).fill(0n);
    for (let y = 0; y <= n; y++) {
      next[y] += row[y];
      next[y + 1] += row[y];
      if (y > 0) next[y - 1] += row[y];
    }
    row = next;
  }
  return row[0];
};
const catalan = (n: number): bigint => binomial(2 * n, n) / BigInt(n + 1);

test("the linear recurrences match convolutions, transforms and state counts", () => {
  const motzkin = range(120).map(motzkinByHeights);
  for (const n of range(120)) expect([n, motzkinExact(n)]).toEqual([n, motzkin[n]]);
  // Riordan: M(n) = R(n) + R(n + 1).
  let riordan = 1n;
  for (const n of range(120)) {
    expect([n, riordanExact(n)]).toEqual([n, riordan]);
    riordan = motzkin[n] - riordan;
  }
  // Schröder: S(n) = S(n − 1) + Σ S(k) S(n − 1 − k).
  const schroeder = [1n];
  for (let n = 1; n <= 200; n++) {
    let s = schroeder[n - 1];
    for (let k = 0; k < n; k++) s += schroeder[k] * schroeder[n - 1 - k];
    schroeder.push(s);
  }
  for (const n of range(200)) expect([n, schroederExact(n)]).toEqual([n, schroeder[n]]);
  // Fine: F(n) = Σ_{m ≥ 2} C(m − 1) F(n − m).
  const fine = [1n];
  for (let n = 1; n <= 200; n++) {
    let f = 0n;
    for (let m = 2; m <= n; m++) f += catalan(m - 1) * fine[n - m];
    fine.push(f);
  }
  for (const n of range(200)) expect([n, fineExact(n)]).toEqual([n, fine[n]]);
});

test("words and compositions match the recurrence over their own definition", () => {
  // Words of length n with no w ones in a row: the state is the trailing run of ones.
  const noRun = (n: number, w: number): bigint => {
    let state: bigint[] = [1n, ...Array<bigint>(w - 1).fill(0n)];
    for (let i = 0; i < n; i++) {
      const next: bigint[] = Array<bigint>(w).fill(0n);
      for (let run = 0; run < w; run++) {
        next[0] += state[run];
        if (run + 1 < w) next[run + 1] += state[run];
      }
      state = next;
    }
    return state.reduce((a, b) => a + b, 0n);
  };
  for (const n of range(200)) {
    expect([n, fibonacciWordsExact(n)]).toEqual([n, noRun(n, 2)]);
    expect([n, triStringsExact(n)]).toEqual([n, noRun(n, 3)]);
    expect([n, windowSumsExact(n, 2)]).toEqual([n, compositions(n, (p) => p <= 2)]);
    expect([n, windowSumsExact(n, 3)]).toEqual([n, compositions(n, (p) => p <= 3)]);
    expect([n, windowSumsExact(n, 4)]).toEqual([n, compositions(n, (p) => p <= 4)]);
    expect([n, oddCompositionsExact(n)]).toEqual([n, compositions(n, (p) => p % 2 === 1)]);
    expect([n, properCompositionsExact(n)]).toEqual([n, compositions(n, (p) => p >= 2)]);
  }
  for (const n of range(120)) {
    expect([n, dyadicCompositionsExact(n)]).toEqual([n, compositions(n, (p) => (p & (p - 1)) === 0)]);
    expect([n, triangularCompositionsExact(n)]).toEqual([
      n,
      compositions(n, (p) => Number.isInteger((Math.sqrt(8 * p + 1) - 1) / 2)),
    ]);
    expect([n, primeCompositionsExact(n)]).toEqual([
      n,
      compositions(n, (p) => p > 1 && range(p - 1).every((d) => d < 2 || p % d !== 0)),
    ]);
  }
  expect(fibonacciExact(90)).toBe(2880067194370816120n);
});

test("boolean permutations are F(2n − 1)", () => {
  expect(booleanPermutationsExact(0)).toBe(1n);
  for (const n of range(120).slice(1)) expect([n, booleanPermutationsExact(n)]).toEqual([n, fibonacciExact(2 * n - 1)]);
});

test("Dyck paths by height sum over the heights to the Catalan numbers, and are one at the ends", () => {
  for (const n of [0, 1, 2, 5, 12, 40, 90]) {
    let total = 0n;
    for (let h = 0; h <= n + 1; h++) total += dyckPathsByHeightExact(n, h)!;
    expect([n, total]).toEqual([n, catalan(n)]);
    expect(dyckPathsByHeightExact(n, n)).toBe(1n);
  }
  expect(dyckPathsByHeightExact(4, 2)).toBe(7n);
  expect(dyckPathsByHeightExact(0, 3)).toBe(0n);
  expect(dyckPathsByHeightExact(5, 0)).toBe(0n);
});

test("Dyck paths by height match a direct walk that tracks whether the height was reached", () => {
  /** Walks of 2n steps from 0 to 0 never below 0, the state the height and whether h has been reached. */
  const byWalk = (n: number, h: number): bigint => {
    let at: bigint[][] = Array.from({ length: h + 2 }, () => [0n, 0n]);
    at[0][h === 0 ? 1 : 0] = 1n;
    for (let step = 0; step < 2 * n; step++) {
      const next: bigint[][] = Array.from({ length: h + 2 }, () => [0n, 0n]);
      for (let y = 0; y <= h; y++)
        for (const reached of [0, 1]) {
          const here = at[y][reached];
          if (here === 0n) continue;
          if (y < h) next[y + 1][reached || y + 1 === h ? 1 : 0] += here;
          if (y > 0) next[y - 1][reached] += here;
        }
      at = next;
    }
    return at[0][1];
  };
  for (const [n, h] of [
    [150, 1],
    [150, 7],
    [150, 40],
    [150, 150],
    [300, 12],
    [300, 100],
    [40, 41],
  ] as const)
    expect([n, h, dyckPathsByHeightExact(n, h)]).toEqual([n, h, n === 40 ? 0n : byWalk(n, h)]);
});

test("Stirling numbers and what they add up to match the explicit sums", () => {
  /** k! S(n, k) = Σ (−1)^(k − j) C(k, j) j^n. */
  const surjections = (n: number, k: number): bigint => {
    let sum = 0n;
    for (let j = 0; j <= k; j++) sum += (-1n) ** BigInt(k - j) * binomial(k, j) * BigInt(j) ** BigInt(n);
    return sum;
  };
  for (const [n, k] of [
    [0, 0],
    [0, 3],
    [5, 0],
    [3, 5],
    [10, 4],
    [60, 5],
    [200, 12],
    [150, 150],
    [150, 149],
    [300, 40],
  ] as const) {
    expect([n, k, surjectionsExact(n, k)]).toEqual([n, k, surjections(n, k)]);
    expect([n, k, stirlingSecondExact(n, k)]).toEqual([n, k, surjections(n, k) / factorial(k)]);
  }
  // Bell by its triangle, Fubini by Σ C(n, k) Fubini(n − k).
  let row = [1n];
  const fubini = [1n];
  for (let n = 1; n <= 100; n++) {
    const next = [row[row.length - 1]];
    for (const x of row) next.push(next[next.length - 1] + x);
    row = next;
    let f = 0n;
    for (let k = 1; k <= n; k++) f += binomial(n, k) * fubini[n - k];
    fubini.push(f);
    expect([n, bellExact(n)]).toEqual([n, row[0]]);
    expect([n, fubiniExact(n)]).toEqual([n, f]);
  }
  expect([bellExact(0), fubiniExact(0)]).toEqual([1n, 1n]);
});

test("semistandard tableaux add the hook-content counts over the shapes", () => {
  /** The partitions of n, parts descending. */
  const partitions = (n: number, most = n): number[][] =>
    n === 0
      ? [[]]
      : range(Math.min(n, most))
          .slice(1)
          .flatMap((p) => partitions(n - p, p).map((rest) => [p, ...rest]));
  /** s_λ(1^k) = Π (k + c)/h over the cells, one exact division. */
  const hookContent = (shape: number[], k: number): bigint => {
    if (shape.length > k) return 0n;
    let up = 1n;
    let down = 1n;
    shape.forEach((length, r) => {
      for (let c = 0; c < length; c++) {
        const below = shape.filter((l) => l > c).length - r - 1;
        up *= BigInt(k + c - r);
        down *= BigInt(length - c - 1 + below + 1);
      }
    });
    expect(up % down).toBe(0n);
    return up / down;
  };
  for (const [n, k] of [
    [0, 0],
    [3, 0],
    [0, 4],
    [4, 1],
    [6, 2],
    [12, 3],
    [20, 5],
    [26, 9],
    [30, 4],
    [18, 40],
  ] as const) {
    const expected = partitions(n).reduce((sum, shape) => sum + hookContent(shape, k), 0n);
    expect([n, k, semistandardTableauxExact(n, k)]).toEqual([n, k, expected]);
  }
});

test("shifted standard tableaux add Thrall's counts over the strict shapes", () => {
  const strict = (n: number, most = n): number[][] =>
    n === 0
      ? [[]]
      : range(Math.min(n, most))
          .slice(1)
          .flatMap((p) => strict(n - p, p - 1).map((rest) => [p, ...rest]));
  const thrall = (shape: number[], n: number): bigint => {
    let up = factorial(n);
    let down = 1n;
    shape.forEach((a, i) => {
      down *= factorial(a);
      for (const b of shape.slice(i + 1)) {
        up *= BigInt(a - b);
        down *= BigInt(a + b);
      }
    });
    expect(up % down).toBe(0n);
    return up / down;
  };
  for (const n of [0, 1, 2, 3, 4, 7, 12, 20, 33, 40, 45]) {
    const expected = strict(n).reduce((sum, shape) => sum + thrall(shape, n), 0n);
    expect([n, shiftedStandardTableauxExact(n)]).toEqual([n, expected]);
  }
});

test("a count past the work or size limit is left undefined", () => {
  expect(motzkinExact(RECURRENCE_TOP)).toBeDefined();
  expect(motzkinExact(RECURRENCE_TOP + 1)).toBeUndefined();
  expect(fibonacciWordsExact(RECURRENCE_TOP)).toBeDefined();
  expect(fibonacciWordsExact(RECURRENCE_TOP + 1)).toBeUndefined();
  expect(triStringsExact(RECURRENCE_TOP + 1)).toBeUndefined();
  expect(oddCompositionsExact(RECURRENCE_TOP + 1)).toBeUndefined();
  expect(properCompositionsExact(RECURRENCE_TOP + 1)).toBeUndefined();
  expect(bellExact(5000)).toBeUndefined();
  expect(fubiniExact(5000)).toBeUndefined();
  expect(stirlingSecondExact(20_000, 4000)).toBeUndefined();
  expect(dyckPathsByHeightExact(40_000, 20_000)).toBeUndefined();
  expect(semistandardTableauxExact(100_000, 1000)).toBeUndefined();
  expect(shiftedStandardTableauxExact(400)).toBeUndefined();
  expect(primeCompositionsExact(30_000)).toBeUndefined();
});

test("a huge param is answered or declined at once, never looped over", () => {
  const quick = (f: () => bigint | undefined): bigint | undefined => {
    const start = performance.now();
    const answer = f();
    expect(performance.now() - start).toBeLessThan(50);
    return answer;
  };
  // More blocks, letters or height than cells: none.
  for (const k of [10, 300_000, 1e9, 2 ** 52]) {
    expect(quick(() => surjectionsExact(5, k))).toBe(0n);
    expect(quick(() => surjectionsExact(0, k))).toBe(0n);
    expect(quick(() => stirlingSecondExact(5, k))).toBe(0n);
    expect(quick(() => stirlingSecondExact(0, k))).toBe(0n);
    expect(quick(() => dyckPathsByHeightExact(5, k))).toBe(0n);
  }
  // Too many cells for the table.
  for (const [n, k] of [
    [1e9, 5],
    [2 ** 40, 2 ** 40],
    [100_000, 100_000],
  ] as const) {
    expect(quick(() => surjectionsExact(n, k))).toBeUndefined();
    expect(quick(() => stirlingSecondExact(n, k))).toBeUndefined();
    expect(quick(() => dyckPathsByHeightExact(n, k))).toBeUndefined();
    expect(quick(() => semistandardTableauxExact(n, k))).toBeUndefined();
  }
  expect(quick(() => semistandardTableauxExact(0, 1e9))).toBe(1n);
  expect(quick(() => semistandardTableauxExact(5, 1e9))).toBeUndefined();
  for (const n of [1e9, 2 ** 52]) {
    for (const f of [bellExact, fubiniExact, shiftedStandardTableauxExact, primeCompositionsExact, motzkinExact])
      expect(quick(() => f(n))).toBeUndefined();
  }
});

test("no counter answers a negative, fractional or unsafe param", () => {
  const unary = [
    bellExact,
    booleanPermutationsExact,
    dyadicCompositionsExact,
    fibonacciExact,
    fibonacciWordsExact,
    fineExact,
    fubiniExact,
    motzkinExact,
    oddCompositionsExact,
    primeCompositionsExact,
    properCompositionsExact,
    riordanExact,
    schroederExact,
    shiftedStandardTableauxExact,
    triStringsExact,
    triangularCompositionsExact,
    (n: number) => windowSumsExact(n, 3),
  ];
  for (const bad of [-1, -2, -0.5, 0.5, 2.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53, -(2 ** 60)])
    for (const f of unary) expect([bad, f(bad)]).toEqual([bad, undefined]);
  const binary = [dyckPathsByHeightExact, semistandardTableauxExact, stirlingSecondExact, surjectionsExact];
  for (const bad of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53])
    for (const f of binary) {
      expect([bad, 3, f(bad, 3)]).toEqual([bad, 3, undefined]);
      expect([3, bad, f(3, bad)]).toEqual([3, bad, undefined]);
    }
});
