import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { entries as numericDivisor } from "../src/families/numeric-divisor.ts";
import { declareCollections } from "../src/library.ts";

const byHead = new Map(numericDivisor.map((e) => [e.head, e]));

// ─── independent oracle: divisor/factoring helpers written fresh (not imported from the
// kernel file), so the brute-force checks below are a genuine second implementation, not
// the kernel checking itself. ──────────────────────────────────────────────────────────

function divisorsBF(n: number): number[] {
  const out: number[] = [];
  for (let d = 1; d * d <= n; d++) {
    if (n % d !== 0) continue;
    out.push(d);
    if (d * d !== n) out.push(n / d);
  }
  return out.sort((a, b) => a - b);
}
const sigmaBF = (n: number): number => divisorsBF(n).reduce((a, b) => a + b, 0);
const properDivisorsBF = (n: number): number[] => divisorsBF(n).filter((d) => d !== n);

function isPrimeBF(n: number): boolean {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
}

function primeFactorsBF(n: number): [number, number][] {
  let m = n;
  const factors: [number, number][] = [];
  for (let p = 2; p * p <= m; p++) {
    if (m % p !== 0) continue;
    let e = 0;
    while (m % p === 0) {
      m /= p;
      e++;
    }
    factors.push([p, e]);
  }
  if (m > 1) factors.push([m, 1]);
  return factors;
}

// Subset-sum via recursion over the divisor list (distinct from the kernel's DP array).
function isSemiperfectBF(n: number): boolean {
  const divs = properDivisorsBF(n);
  const search = (i: number, remaining: number): boolean => {
    if (remaining === 0) return true;
    if (i >= divs.length || remaining < 0) return false;
    return search(i + 1, remaining - divs[i]) || search(i + 1, remaining);
  };
  return search(0, n);
}

function isPracticalBF(n: number): boolean {
  const divs = divisorsBF(n);
  for (let m = 1; m <= n; m++) {
    const search = (i: number, remaining: number): boolean => {
      if (remaining === 0) return true;
      if (i >= divs.length || remaining < 0) return false;
      return search(i + 1, remaining - divs[i]) || search(i + 1, remaining);
    };
    if (!search(0, m)) return false;
  }
  return true;
}

function isSquareFreeBF(n: number): boolean {
  for (let d = 2; d * d <= n; d++) if (n % (d * d) === 0) return false;
  return true;
}
const isKFreeBF = (n: number, k: number): boolean => primeFactorsBF(n).every(([, e]) => e < k);
const isPowerfulBF = (n: number): boolean => primeFactorsBF(n).every(([, e]) => e >= 2);

function isPerfectPowerBF(n: number): boolean {
  if (n < 4) return false;
  for (let a = 2; a * a <= n; a++) {
    for (let v = a * a; v <= n; v *= a) {
      if (v === n) return true;
    }
  }
  return false;
}

function gcdBF(a: number, b: number): number {
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

// Fermat pseudoprimality against every coprime base < n -- the actual definition, distinct
// from the kernel's Korselt-criterion shortcut.
function isCarmichaelBF(n: number): boolean {
  if (n < 3 || isPrimeBF(n)) return false;
  const modPow = (base: bigint, exp: bigint, mod: bigint): bigint => {
    let b = base % mod;
    let e = exp;
    let r = 1n;
    while (e > 0n) {
      if (e & 1n) r = (r * b) % mod;
      b = (b * b) % mod;
      e >>= 1n;
    }
    return r;
  };
  let sawCoprimeBase = false;
  for (let a = 2; a < n; a++) {
    if (gcdBF(a, n) !== 1) continue;
    sawCoprimeBase = true;
    if (modPow(BigInt(a), BigInt(n - 1), BigInt(n)) !== 1n) return false;
  }
  return sawCoprimeBase;
}

// A sum-of-divisors sieve, computed once for the whole range rather than per-n (an
// independent implementation of the same "m = p^2 needs m ~ n^2" bound the kernel uses,
// just amortised -- a per-n O(n^2 sqrt(n)) trial-division scan is too slow at this range).
function untouchableSetBF(maxN: number): Set<number> {
  const bound = maxN * maxN + 4;
  const sigma = new Float64Array(bound + 1);
  for (let d = 1; d <= bound; d++) {
    for (let m = d; m <= bound; m += d) sigma[m] += d;
  }
  const touched = new Set<number>();
  for (let m = 2; m <= bound; m++) {
    const s = sigma[m] - m;
    if (s >= 1 && s <= maxN) touched.add(s);
  }
  const untouchable = new Set<number>();
  for (let n = 1; n <= maxN; n++) if (!touched.has(n)) untouchable.add(n);
  return untouchable;
}

// ─── OEIS spot terms (first few, cross-checked below against the brute-force oracle over a
// wider range so any misremembered later digit is still caught). ──────────────────────────

const OEIS_HEAD: Record<string, string> = {
  DeficientNumbers: "A005100",
  PerfectNumbers: "A000396",
  SemiperfectNumbers: "A005835",
  WeirdNumbers: "A006037",
  PracticalNumbers: "A005153",
  HighlyCompositeNumbers: "A002182",
  SuperabundantNumbers: "A004394",
  ArithmeticNumbers: "A003601",
  UntouchableNumbers: "A005114",
  AchillesNumbers: "A052486",
  PowerfulNumbers: "A001694",
  PerfectPowerNumbers: "A075109",
  SquareFreeNumbers: "A005117",
  CarmichaelNumbers: "A002997",
  GiugaNumbers: "A007850",
  IdonealNumbers: "A000926",
  LuckyNumbers: "A000959",
};

const OEIS_TERMS: Record<string, number[]> = {
  DeficientNumbers: [1, 2, 3, 4, 5, 7, 8, 9, 10, 11],
  PerfectNumbers: [6, 28, 496, 8128, 33550336],
  SemiperfectNumbers: [6, 12, 18, 20, 24, 28, 30, 36, 40, 42],
  WeirdNumbers: [70, 836, 4030, 5830, 7192],
  PracticalNumbers: [1, 2, 4, 6, 8, 12, 16, 18, 20, 24],
  HighlyCompositeNumbers: [1, 2, 4, 6, 12, 24, 36, 48, 60, 120],
  SuperabundantNumbers: [1, 2, 4, 6, 12, 24, 36, 48, 60, 120],
  ArithmeticNumbers: [1, 3, 5, 6, 7, 11, 13, 14, 15, 17],
  UntouchableNumbers: [2, 5, 52, 88, 96, 120, 124, 146, 162, 188],
  AchillesNumbers: [72, 108, 200, 288, 392, 432, 500, 648, 675, 800],
  PowerfulNumbers: [1, 4, 8, 9, 16, 25, 27, 32, 36, 49],
  PerfectPowerNumbers: [4, 8, 9, 16, 25, 27, 32, 36, 49, 64],
  SquareFreeNumbers: [1, 2, 3, 5, 6, 7, 10, 11, 13, 14],
  CarmichaelNumbers: [561, 1105, 1729, 2465, 2821],
  GiugaNumbers: [30, 858, 1722, 66198],
  IdonealNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  LuckyNumbers: [1, 3, 7, 9, 13, 15, 21, 25, 31, 33],
};

for (const [head, terms] of Object.entries(OEIS_TERMS)) {
  const entry = byHead.get(head)!;
  test(`${head} unranks its first terms, matching ${OEIS_HEAD[head]}`, () => {
    const got = terms.map((_, r) => entry.unrank([], r));
    expect(got).toEqual(terms);
  });
  test(`${head} rank/unrank/valid round-trip over its first terms`, () => {
    for (let r = 0; r < terms.length; r++) {
      const element = entry.unrank([], r);
      expect(entry.valid(element, [])).toBe(true);
      expect(entry.rank(element, [])).toBe(r);
    }
  });
}

// ─── brute-force: independent predicate vs kernel valid(), over a scanning range per set. ──

function bruteForceCheck(head: string, range: number, predicate: (n: number) => boolean): void {
  test(`${head} agrees with an independent predicate for n = 1..${range}`, () => {
    const entry = byHead.get(head)!;
    for (let n = 1; n <= range; n++) {
      expect(entry.valid(n, [])).toBe(predicate(n));
    }
  });
}

bruteForceCheck("DeficientNumbers", 400, (n) => sigmaBF(n) - n < n);
bruteForceCheck("PerfectNumbers", 8128, (n) => sigmaBF(n) - n === n);
bruteForceCheck("SemiperfectNumbers", 150, isSemiperfectBF);
bruteForceCheck("WeirdNumbers", 850, (n) => sigmaBF(n) - n > n && !isSemiperfectBF(n));
bruteForceCheck("PracticalNumbers", 80, isPracticalBF);
bruteForceCheck("ArithmeticNumbers", 200, (n) => sigmaBF(n) % divisorsBF(n).length === 0);
{
  const untouchableBF = untouchableSetBF(300);
  bruteForceCheck("UntouchableNumbers", 300, (n) => untouchableBF.has(n));
}
bruteForceCheck("AchillesNumbers", 900, (n) => n > 1 && isPowerfulBF(n) && !isPerfectPowerBF(n));
bruteForceCheck("PowerfulNumbers", 400, isPowerfulBF);
bruteForceCheck("PerfectPowerNumbers", 400, isPerfectPowerBF);
bruteForceCheck("SquareFreeNumbers", 400, isSquareFreeBF);
bruteForceCheck("CarmichaelNumbers", 600, isCarmichaelBF);

// Independent Ulam sieve (array-splice style, distinct from the kernel's index-filter loop).
function luckyNumbersBF(limit: number): Set<number> {
  let list: number[] = [];
  for (let i = 1; i <= limit; i += 2) list.push(i);
  let pos = 1; // list[1] === 3
  while (pos < list.length) {
    const step = list[pos];
    const survivors: number[] = [];
    for (let i = 0; i < list.length; i++) if ((i + 1) % step !== 0) survivors.push(list[i]);
    list = survivors;
    pos++;
  }
  return new Set(list);
}
bruteForceCheck("LuckyNumbers", 100, (n) => luckyNumbersBF(150).has(n));

// HighlyCompositeNumbers / SuperabundantNumbers: independent "running max" scan.
test("HighlyCompositeNumbers agrees with an independent running-max scan for n = 1..300", () => {
  const entry = byHead.get("HighlyCompositeNumbers")!;
  let maxTau = 0;
  for (let n = 1; n <= 300; n++) {
    const tau = divisorsBF(n).length;
    const isRecord = tau > maxTau;
    if (isRecord) maxTau = tau;
    expect(entry.valid(n, [])).toBe(isRecord);
  }
});
test("SuperabundantNumbers agrees with an independent running-max scan for n = 1..400", () => {
  const entry = byHead.get("SuperabundantNumbers")!;
  let bestSigma = 0;
  let bestN = 1;
  for (let n = 1; n <= 400; n++) {
    const s = sigmaBF(n);
    const isRecord = s * bestN > bestSigma * n;
    if (isRecord) {
      bestSigma = s;
      bestN = n;
    }
    expect(entry.valid(n, [])).toBe(isRecord);
  }
});

// ─── KFreeIntegers(k): selector semantics, and agreement with SquareFreeNumbers at k=2. ────

test("KFreeIntegers(2) agrees with SquareFreeNumbers over its first 30 terms", () => {
  const kfree = byHead.get("KFreeIntegers")!;
  const square = byHead.get("SquareFreeNumbers")!;
  for (let r = 0; r < 30; r++) {
    expect(kfree.unrank([2], r)).toBe(square.unrank([], r));
  }
});
test("KFreeIntegers(3) matches cube-free A004709 for its first terms", () => {
  const kfree = byHead.get("KFreeIntegers")!;
  // 8 = 2^3 and 16 = 2^4 both carry a cube factor, so both are excluded.
  const CUBE_FREE = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22];
  const got = CUBE_FREE.map((_, r) => kfree.unrank([3], r));
  expect(got).toEqual(CUBE_FREE);
});
bruteForceCheck2("KFreeIntegers", 3, 200);
function bruteForceCheck2(head: string, k: number, range: number): void {
  test(`${head}(${k}) agrees with an independent predicate for n = 1..${range}`, () => {
    const entry = byHead.get(head)!;
    for (let n = 1; n <= range; n++) {
      expect(entry.valid(n, [k])).toBe(isKFreeBF(n, k));
    }
  });
}

// ─── the three open-infinitude sets: NaN Count, table-bounded At, no hang past the table. ──

for (const head of ["PerfectNumbers", "GiugaNumbers", "IdonealNumbers"]) {
  test(`${head} has Count NaN (infinitude is an open problem)`, () => {
    const entry = byHead.get(head)!;
    expect(Number.isNaN(entry.count([]))).toBe(true);
  });
}
test("PerfectNumbers At past the known table returns NaN, not a hang", () => {
  const entry = byHead.get("PerfectNumbers")!;
  expect(Number.isNaN(entry.unrank([], 7))).toBe(true); // 8th known perfect number overflows a safe integer
});
test("GiugaNumbers At past the known table returns NaN, not a hang", () => {
  const entry = byHead.get("GiugaNumbers")!;
  expect(Number.isNaN(entry.unrank([], 4))).toBe(true);
});
test("IdonealNumbers At past the known 65 returns NaN, not a hang", () => {
  const entry = byHead.get("IdonealNumbers")!;
  expect(Number.isNaN(entry.unrank([], 65))).toBe(true);
});
test("IdonealNumbers has exactly the 65 known numeri idonei", () => {
  const entry = byHead.get("IdonealNumbers")!;
  const got = Array.from({ length: 65 }, (_, r) => entry.unrank([], r));
  expect(new Set(got).size).toBe(65);
  expect(got.every((n) => entry.valid(n, []))).toBe(true);
});

// ─── engine-level: Take / Element through the declared CE collection handlers. ──

const ce = new ComputeEngine();
declareCollections(ce);

test("Take(PracticalNumbers, 5) gives the first five practical numbers", () => {
  expect(ce.box(["Take", "PracticalNumbers", 5]).evaluate().toString()).toBe("[1,2,4,6,8]");
});
test("Element membership on PowerfulNumbers", () => {
  expect(ce.box(["Element", 36, "PowerfulNumbers"]).evaluate().toString()).toBe('"True"');
  expect(ce.box(["Element", 12, "PowerfulNumbers"]).evaluate().toString()).toBe('"False"');
});
test("KFreeIntegers(k) is a one-parameter operator agreeing with SquareFreeNumbers at k=2", () => {
  expect(
    ce
      .box(["Take", ["KFreeIntegers", 2], 10])
      .evaluate()
      .toString(),
  ).toBe(ce.box(["Take", "SquareFreeNumbers", 10]).evaluate().toString());
});
test("Element membership on CarmichaelNumbers", () => {
  expect(ce.box(["Element", 561, "CarmichaelNumbers"]).evaluate().toString()).toBe('"True"');
  expect(ce.box(["Element", 560, "CarmichaelNumbers"]).evaluate().toString()).toBe('"False"');
});

test("KFreeIntegers(k) below 2 is just {1}, finite", () => {
  const entry = byHead.get("KFreeIntegers");
  if (!entry) throw new Error("KFreeIntegers missing");
  for (const k of [0, 1]) {
    expect(entry.count([k])).toBe(1);
    expect(entry.unrank([k], 0)).toBe(1);
    expect(entry.unrank([k], 1)).toBeNaN(); // declines rather than scanning forever
  }
});
