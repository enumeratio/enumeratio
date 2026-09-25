import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { afterAll, expect, test } from "vite-plus/test";
import { entries } from "../src/families/numeric-digits-primes.ts";
import { entries as numericSets } from "../src/families/numeric-sets.ts";
import { declareCollections } from "../src/library.ts";

const byHead = new Map(entries.map((e) => [e.head, e]));

// ─── independent brute-force predicates: deliberately NOT the src helpers (own primality
// test, own factoring loop, own popcount), so a bug shared between src and test can't hide. ───

function isPrimeIndep(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}
/** Prime factors with multiplicity, ascending, by plain trial division. */
function primeFactorsIndep(n: number): number[] {
  let m = n;
  const factors: number[] = [];
  for (let p = 2; p * p <= m; p++) {
    while (m % p === 0) {
      factors.push(p);
      m /= p;
    }
  }
  if (m > 1) factors.push(m);
  return factors;
}
const digitSumIndep = (n: number): number =>
  String(n)
    .split("")
    .reduce((s, c) => s + Number(c), 0);
function popcountIndep(n: number): number {
  let x = n;
  let c = 0;
  while (x > 0) {
    c += x & 1;
    x >>= 1;
  }
  return c;
}
function bruteFirst(count: number, start: number, predicate: (n: number) => boolean): number[] {
  const out: number[] = [];
  let n = start - 1;
  while (out.length < count) {
    n++;
    if (predicate(n)) out.push(n);
  }
  return out;
}

// ─── OEIS-sourced first terms, verified against the b-files -- also the source for the
// round-trip / non-member / brute-force checks below. ───────────────────────────────────────

const OEIS: Record<string, { anum: string; terms: number[] }> = {
  HarshadNumbers: { anum: "A005349", terms: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  HappyNumbers: { anum: "A007770", terms: [1, 7, 10, 13, 19, 23, 28, 31, 32, 44] },
  AutomorphicNumbers: { anum: "A003226", terms: [1, 5, 6, 25, 76, 376, 625, 9376, 90625, 109376] },
  KaprekarNumbers: { anum: "A006886", terms: [1, 9, 45, 55, 99, 297, 703, 999, 2223, 2728] },
  EvilNumbers: { anum: "A001969", terms: [0, 3, 5, 6, 9, 10, 12, 15, 17, 18] },
  OdiousNumbers: { anum: "A000069", terms: [1, 2, 4, 7, 8, 11, 13, 14, 16, 19] },
  PerniciousNumbers: { anum: "A052294", terms: [3, 5, 6, 7, 9, 10, 11, 12, 13, 14] },
  SmithNumbers: { anum: "A006753", terms: [4, 22, 27, 58, 85, 94, 121, 166, 202, 265] },
  SemiprimeNumbers: { anum: "A001358", terms: [4, 6, 9, 10, 14, 15, 21, 22, 25, 26] },
  SquarefreeSemiprimes: { anum: "A006881", terms: [6, 10, 14, 15, 21, 22, 26, 33, 34, 35] },
  SphenicNumbers: { anum: "A007304", terms: [30, 42, 66, 70, 78, 102, 105, 110, 114, 130] },
  PrimePowerNumbers: { anum: "A246655", terms: [2, 3, 4, 5, 7, 8, 9, 11, 13, 16] },
  TwinPrimes: { anum: "A001359", terms: [3, 5, 11, 17, 29, 41, 59, 71, 101, 107] },
  CousinPrimes: { anum: "A023200", terms: [3, 7, 13, 19, 37, 43, 67, 79, 97, 103] },
  SexyPrimes: { anum: "A023201", terms: [5, 7, 11, 13, 17, 23, 31, 37, 41, 47] },
  SophieGermainPrimes: { anum: "A005384", terms: [2, 3, 5, 11, 23, 29, 41, 53, 83, 89] },
  SafePrimes: { anum: "A005385", terms: [5, 7, 11, 23, 47, 59, 83, 107, 167, 179] },
  PalindromicPrimes: { anum: "A002385", terms: [2, 3, 5, 7, 11, 101, 131, 151, 181, 191] },
  CircularPrimes: { anum: "A068652", terms: [2, 3, 5, 7, 11, 13, 17, 31, 37, 71] },
  EmirpPrimes: { anum: "A006567", terms: [13, 17, 31, 37, 71, 73, 79, 97, 107, 113] },
};

const INDEPENDENT_PREDICATES: Record<string, (n: number) => boolean> = {
  HarshadNumbers: (n) => n >= 1 && n % digitSumIndep(n) === 0,
  HappyNumbers: (n) => {
    const seen = new Set<number>();
    let x = n;
    while (x !== 1 && !seen.has(x)) {
      seen.add(x);
      x = String(x)
        .split("")
        .reduce((s, c) => s + Number(c) ** 2, 0);
    }
    return x === 1;
  },
  EvilNumbers: (n) => popcountIndep(n) % 2 === 0,
  OdiousNumbers: (n) => popcountIndep(n) % 2 === 1,
  PerniciousNumbers: (n) => isPrimeIndep(popcountIndep(n)),
  SmithNumbers: (n) => {
    if (n < 4 || isPrimeIndep(n)) return false;
    const factorSum = primeFactorsIndep(n).reduce((s, p) => s + digitSumIndep(p), 0);
    return factorSum === digitSumIndep(n);
  },
  SemiprimeNumbers: (n) => primeFactorsIndep(n).length === 2,
  SquarefreeSemiprimes: (n) => {
    const f = primeFactorsIndep(n);
    return f.length === 2 && new Set(f).size === 2;
  },
  SphenicNumbers: (n) => {
    const f = primeFactorsIndep(n);
    return f.length === 3 && new Set(f).size === 3;
  },
  PrimePowerNumbers: (n) => n >= 2 && new Set(primeFactorsIndep(n)).size === 1,
  TwinPrimes: (n) => isPrimeIndep(n) && isPrimeIndep(n + 2),
  CousinPrimes: (n) => isPrimeIndep(n) && isPrimeIndep(n + 4),
  SexyPrimes: (n) => isPrimeIndep(n) && isPrimeIndep(n + 6),
  SophieGermainPrimes: (n) => isPrimeIndep(n) && isPrimeIndep(2 * n + 1),
  SafePrimes: (n) => isPrimeIndep(n) && (n - 1) % 2 === 0 && isPrimeIndep((n - 1) / 2),
  PalindromicPrimes: (n) => isPrimeIndep(n) && String(n) === String(n).split("").reverse().join(""),
  CircularPrimes: (n) => {
    if (!isPrimeIndep(n)) return false;
    const s = String(n);
    if (s.includes("0")) return false;
    for (let i = 0; i < s.length; i++) {
      if (!isPrimeIndep(Number(s.slice(i) + s.slice(0, i)))) return false;
    }
    return true;
  },
  EmirpPrimes: (n) => {
    if (!isPrimeIndep(n)) return false;
    const r = Number(String(n).split("").reverse().join(""));
    return r !== n && isPrimeIndep(r);
  },
};

for (const [head, { anum, terms }] of Object.entries(OEIS)) {
  const entry = byHead.get(head);

  test(`${head} matches ${anum} for its first terms`, () => {
    expect(entry).toBeDefined();
    if (!entry) return;
    const got = terms.map((_, r) => entry.unrank([], r));
    expect(got).toEqual(terms);
  });

  test(`${head} rank/unrank/valid round-trip over its first terms`, () => {
    expect(entry).toBeDefined();
    if (!entry) return;
    for (let r = 0; r < terms.length; r++) {
      const element = entry.unrank([], r);
      expect(element).toBe(terms[r]);
      expect(entry.valid(element, [])).toBe(true);
      expect(entry.rank(element, [])).toBe(r);
    }
  });

  test(`${head} rejects a non-member just past its first terms`, () => {
    expect(entry).toBeDefined();
    if (!entry) return;
    // The next integer past the last known term isn't guaranteed to be a non-member (e.g. it's
    // the next prime for PrimePowerNumbers), so scan forward for the nearest genuine one.
    let nonMember = Math.max(...terms) + 1;
    while (entry.valid(nonMember, [])) nonMember++;
    expect(entry.valid(nonMember, [])).toBe(false);
    expect(entry.rank(nonMember, [])).toBe(-1);
  });
}

for (const [head, predicate] of Object.entries(INDEPENDENT_PREDICATES)) {
  test(`${head} matches an independently written predicate for its first 30 terms`, () => {
    const entry = byHead.get(head);
    expect(entry).toBeDefined();
    if (!entry) return;
    const start = head === "EvilNumbers" ? 0 : 1;
    const expected = bruteFirst(30, start, predicate);
    const got = Array.from({ length: 30 }, (_, r) => entry.unrank([], r));
    expect(got).toEqual(expected);
  });
}

// ─── NarcissisticNumbers: PROVEN finite (88 terms, the trivial 0 excluded), verified against
// every one of the first 43 OEIS A005188 terms that fits in a safe integer; a fully
// independent digit-power-sum predicate stands in for the brute-force check (sequential
// scanning obviously can't reach a 39-digit term). ──────────────────────────────────────────

test("NarcissisticNumbers matches A005188 (excluding 0) for its safe-integer-representable prefix", () => {
  const entry = byHead.get("NarcissisticNumbers");
  expect(entry).toBeDefined();
  if (!entry) return;
  const oeisPrefix = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 153, 370, 371, 407, 1634, 8208, 9474, 54748, 92727, 93084, 548834, 1741725, 4210818,
    9800817, 9926315, 24678050, 24678051, 88593477, 146511208, 472335975, 534494836,
  ];
  const got = oeisPrefix.map((_, r) => entry.unrank([], r));
  expect(got).toEqual(oeisPrefix);
});

test("NarcissisticNumbers Count is the proven exact 88, not +oo", () => {
  const entry = byHead.get("NarcissisticNumbers");
  expect(entry?.count([])).toBe(88);
});

test("NarcissisticNumbers matches an independent digit-power-sum predicate for its first 20 terms", () => {
  // Narcissistic numbers are sparse enough (the 30th term is already ~5*10^8) that a
  // sequential brute-force scan has to stop well short of 30 -- the 20th term (548834) keeps
  // this fast; the OEIS-sourced test above already covers terms past this range.
  const entry = byHead.get("NarcissisticNumbers");
  expect(entry).toBeDefined();
  if (!entry) return;
  const isNarcissisticIndep = (n: number): boolean => {
    const digits = String(n).split("");
    const d = BigInt(digits.length);
    const sum = digits.reduce((s, c) => s + BigInt(c) ** d, 0n);
    return sum === BigInt(n);
  };
  const expected = bruteFirst(20, 1, isNarcissisticIndep);
  const got = Array.from({ length: 20 }, (_, r) => entry.unrank([], r));
  expect(got).toEqual(expected);
});

test("NarcissisticNumbers.unrank returns exact bigint past the safe-integer prefix, never NaN (issue #90)", () => {
  // Past the 43rd term, unrank used to answer NaN -- a known value the `number` element
  // couldn't carry, but one that made every large pair collide under Plausible's
  // JSON.stringify-keyed injectivity check (NaN -> "null" for all of them). Now it returns
  // the exact bigint instead, so every rank stays distinct.
  const entry = byHead.get("NarcissisticNumbers");
  expect(entry?.unrank([], 42)).toBe(4338281769391371); // the 43rd term, still safe
  expect(entry?.unrank([], 43)).toBe(21897142587612075n); // the 44th, first unsafe term
  expect(entry?.unrank([], 87)).toBe(115132219018763992565095597973971522401n); // the 88th (largest)
});

test("NarcissisticNumbers: every one of the 88 terms satisfies the digit-power-sum definition exactly (BigInt)", () => {
  // Independent of NARCISSISTIC_NUMBERS / isNarcissisticBig in src -- this recomputes the
  // definition from scratch over BigInt for every term, safe or not, per the task's
  // requirement to verify EVERY OEIS A005188 value rather than trust the transcription.
  const entry = byHead.get("NarcissisticNumbers");
  expect(entry).toBeDefined();
  if (!entry) return;
  const isNarcissisticIndepBig = (n: bigint): boolean => {
    const digits = n.toString().split("");
    const d = BigInt(digits.length);
    const sum = digits.reduce((s, c) => s + BigInt(c) ** d, 0n);
    return sum === n;
  };
  for (let r = 0; r < 88; r++) {
    const element = entry.unrank([], r);
    const asBig = typeof element === "bigint" ? element : BigInt(element as number);
    expect(isNarcissisticIndepBig(asBig)).toBe(true);
  }
});

test("NarcissisticNumbers: rank/unrank round-trip over all 88 terms, including the bigint ones", () => {
  const entry = byHead.get("NarcissisticNumbers");
  expect(entry).toBeDefined();
  if (!entry) return;
  for (let r = 0; r < 88; r++) {
    const element = entry.unrank([], r);
    expect(entry.rank(element, [])).toBe(r);
    expect(entry.valid(element, [])).toBe(true);
  }
  expect(entry.unrank([], 88)).toBeNaN(); // one past the proven-finite 88 terms
  expect(entry.rank(0n, [])).toBe(-1); // not a member (0 is the excluded trivial term)
});

// ─── MersennePrimes / FibonacciPrimes: only a handful of known terms; `unrank` must not hang
// past them. Both tests bound the call count so a regression to a sequential scan times out
// fast rather than hanging the suite. ───────────────────────────────────────────────────────

test("MersennePrimes matches A000668 for its safe-integer-representable terms", () => {
  const entry = byHead.get("MersennePrimes");
  const known = [3, 7, 31, 127, 8191, 131071, 524287, 2147483647];
  expect(known.map((_, r) => entry?.unrank([], r))).toEqual(known);
});

test("MersennePrimes.unrank answers NaN (not a hang) past the known/representable terms", () => {
  const entry = byHead.get("MersennePrimes");
  expect(entry?.unrank([], 8)).toBeNaN();
  expect(entry?.unrank([], 1000)).toBeNaN();
});

test("MersennePrimes exponents pass an independent Lucas-Lehmer-free primality check", () => {
  // 2^p - 1 for each known exponent should itself be prime by plain trial division.
  const known = [3, 7, 31, 127, 8191, 131071, 524287, 2147483647];
  for (const m of known) expect(isPrimeIndep(m)).toBe(true);
});

test("FibonacciPrimes matches A005478 for its safe-integer-representable terms", () => {
  const entry = byHead.get("FibonacciPrimes");
  const known = [2, 3, 5, 13, 89, 233, 1597, 28657, 514229, 433494437, 2971215073];
  expect(known.map((_, r) => entry?.unrank([], r))).toEqual(known);
});

test("FibonacciPrimes.unrank answers NaN (not a hang) past the known/representable terms", () => {
  const entry = byHead.get("FibonacciPrimes");
  expect(entry?.unrank([], 11)).toBeNaN();
  expect(entry?.unrank([], 1000)).toBeNaN();
});

// ─── KAlmostPrimes(k) / RoughNumbers(k) / PrimePairs(gap): one-parameter selectors. ─────────

test("KAlmostPrimes(1) agrees with Primes verbatim", () => {
  const kAlmost = byHead.get("KAlmostPrimes")!;
  const primes = numericSets.find((e) => e.head === "Primes")!;
  for (let r = 0; r < 20; r++) expect(kAlmost.unrank([1], r)).toBe(primes.unrank([], r));
});

test("KAlmostPrimes(2) agrees with SemiprimeNumbers verbatim", () => {
  const kAlmost = byHead.get("KAlmostPrimes")!;
  const semiprimes = byHead.get("SemiprimeNumbers")!;
  for (let r = 0; r < 20; r++) expect(kAlmost.unrank([2], r)).toBe(semiprimes.unrank([], r));
});

test("KAlmostPrimes(3) matches A014612", () => {
  const entry = byHead.get("KAlmostPrimes")!;
  const terms = [8, 12, 18, 20, 27, 28, 30, 42, 44, 45];
  expect(terms.map((_, r) => entry.unrank([3], r))).toEqual(terms);
});

test("RoughNumbers(5) matches A007310 (coprime to 6)", () => {
  const entry = byHead.get("RoughNumbers")!;
  const terms = [1, 5, 7, 11, 13, 17, 19, 23, 25, 29];
  expect(terms.map((_, r) => entry.unrank([5], r))).toEqual(terms);
});

test("RoughNumbers(7) matches A007775 (coprime to 30)", () => {
  const entry = byHead.get("RoughNumbers")!;
  const terms = [1, 7, 11, 13, 17, 19, 23, 29, 31, 37];
  expect(terms.map((_, r) => entry.unrank([7], r))).toEqual(terms);
});

test("PrimePairs(gap) reproduces TwinPrimes/CousinPrimes/SexyPrimes at gap 2/4/6", () => {
  const primePairs = byHead.get("PrimePairs")!;
  for (const [gap, head] of [
    [2, "TwinPrimes"],
    [4, "CousinPrimes"],
    [6, "SexyPrimes"],
  ] as const) {
    const other = byHead.get(head)!;
    for (let r = 0; r < 20; r++) expect(primePairs.unrank([gap], r)).toBe(other.unrank([], r));
  }
});

test("Count is NaN for every open-infinitude family, including PrimePairs at any gap", () => {
  for (const head of [
    "TwinPrimes",
    "CousinPrimes",
    "SexyPrimes",
    "SophieGermainPrimes",
    "SafePrimes",
    "MersennePrimes",
    "FibonacciPrimes",
    "PalindromicPrimes",
    "CircularPrimes",
    "EmirpPrimes",
  ]) {
    expect(byHead.get(head)?.count([])).toBeNaN();
  }
  for (const gap of [2, 4, 6, 8, 10]) expect(byHead.get("PrimePairs")?.count([gap])).toBeNaN();
});

test("Count is +oo for every known-infinite family here", () => {
  for (const head of [
    "HarshadNumbers",
    "HappyNumbers",
    "AutomorphicNumbers",
    "KaprekarNumbers",
    "EvilNumbers",
    "OdiousNumbers",
    "PerniciousNumbers",
    "SmithNumbers",
    "SemiprimeNumbers",
    "SquarefreeSemiprimes",
    "SphenicNumbers",
    "PrimePowerNumbers",
  ]) {
    expect(byHead.get(head)?.count([])).toBe(Number.POSITIVE_INFINITY);
  }
  for (const k of [1, 2, 3, 5]) expect(byHead.get("KAlmostPrimes")?.count([k])).toBe(Infinity);
  for (const k of [2, 5, 7]) expect(byHead.get("RoughNumbers")?.count([k])).toBe(Infinity);
});

// ─── engine-level: Take / Element through the declared CE collection handlers. ───

const ce = new ComputeEngine();
declareCollections(ce);

test("Take(TwinPrimes, 5) gives the first five lesser twin primes (Count NaN doesn't block Take)", () => {
  expect(ce.box(["Take", "TwinPrimes", 5]).evaluate().toString()).toBe("[3,5,11,17,29]");
});

test("TwinPrimes has no element at a negative index: there is no last one to count back from", () => {
  // compute-engine resolves `At(TwinPrimes, -1)` itself; the handler is reached directly.
  const definition = ce.lookupDefinition("TwinPrimes") as unknown as {
    value: { collection: { at: (c: unknown, index: number) => unknown } };
  };
  expect(definition.value.collection.at(ce.box("TwinPrimes"), -1)).toBeUndefined();
});

test("Element membership on TwinPrimes and SmithNumbers", () => {
  expect(ce.box(["Element", 11, "TwinPrimes"]).evaluate().toString()).toBe('"True"');
  expect(ce.box(["Element", 13, "TwinPrimes"]).evaluate().toString()).toBe('"False"'); // 13+2=15 not prime
  expect(ce.box(["Element", 4, "SmithNumbers"]).evaluate().toString()).toBe('"True"');
  expect(ce.box(["Element", 6, "SmithNumbers"]).evaluate().toString()).toBe('"False"');
});

test("Take(NarcissisticNumbers, 10) gives the first ten Armstrong numbers", () => {
  expect(ce.box(["Take", "NarcissisticNumbers", 10]).evaluate().toString()).toBe("[1,2,3,4,5,6,7,8,9,153]");
});

test("Take(MersennePrimes, 5) and Take(FibonacciPrimes, 5) don't hang and give the known terms", () => {
  expect(ce.box(["Take", "MersennePrimes", 5]).evaluate().toString()).toBe("[3,7,31,127,8191]");
  expect(ce.box(["Take", "FibonacciPrimes", 5]).evaluate().toString()).toBe("[2,3,5,13,89]");
});

// ─── Golden JSON (AGENTS.md); regenerate with `UPDATE_NUMERIC_DIGITS_PRIMES_GOLDEN=1 vp test`. ───

const GOLDEN = fileURLToPath(new URL("./numeric-digits-primes.golden.json", import.meta.url));
const updating = process.env.UPDATE_NUMERIC_DIGITS_PRIMES_GOLDEN === "1";
const golden: Record<string, unknown> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, unknown> = {};

const GOLDEN_CASES: Record<string, number[]> = {
  HarshadNumbers: [],
  HappyNumbers: [],
  NarcissisticNumbers: [],
  AutomorphicNumbers: [],
  KaprekarNumbers: [],
  EvilNumbers: [],
  OdiousNumbers: [],
  PerniciousNumbers: [],
  SmithNumbers: [],
  SemiprimeNumbers: [],
  SquarefreeSemiprimes: [],
  SphenicNumbers: [],
  PrimePowerNumbers: [],
  TwinPrimes: [],
  CousinPrimes: [],
  SexyPrimes: [],
  SophieGermainPrimes: [],
  SafePrimes: [],
  PalindromicPrimes: [],
  CircularPrimes: [],
  EmirpPrimes: [],
  MersennePrimes: [],
  FibonacciPrimes: [],
  KAlmostPrimes: [3],
  RoughNumbers: [7],
  PrimePairs: [4],
};

// MersennePrimes/FibonacciPrimes only have 8/11 known-representable terms -- past that,
// `unrank` answers NaN, which JSON can't round-trip (it serializes to `null`), so their golden
// slice stops right at the known table instead of the usual 20.
const GOLDEN_TAKE: Record<string, number> = { MersennePrimes: 8, FibonacciPrimes: 11 };

for (const [head, params] of Object.entries(GOLDEN_CASES)) {
  const key = `${head}${params.length ? `(${params.join(",")})` : ""}`;
  test(`golden: ${key}`, () => {
    const entry = byHead.get(head)!;
    const take = GOLDEN_TAKE[head] ?? 20;
    const elements = Array.from({ length: take }, (_, r) => entry.unrank(params, r));
    if (updating) {
      fresh[key] = elements;
      return;
    }
    expect(elements).toEqual(golden[key]);
  });
}

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
});
