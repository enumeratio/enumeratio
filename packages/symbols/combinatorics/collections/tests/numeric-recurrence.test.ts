import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test, afterAll } from "vite-plus/test";
import { entries } from "../src/families/numeric-recurrence.ts";
import { declareCollections } from "../src/library.ts";

const byHead = new Map(entries.map((e) => [e.head, e]));
const entryOf = (head: string) => {
  const e = byHead.get(head);
  if (!e) throw new Error(`no entry for ${head}`);
  return e;
};

const TERMS = 30;

// ─── independent recurrences, written fresh here (not sharing code with src/families/
// numeric-recurrence.ts) — the same base cases the catalog/OEIS cite, computed a second way. ───

function iterate(seed: bigint[], next: (t: bigint[]) => bigint, n: number): bigint[] {
  const out = [...seed];
  while (out.length < n) out.push(next(out));
  return out.slice(0, n);
}

const INDEPENDENT: Record<string, bigint[]> = {
  // Fₙ = Fₙ₋₁ + Fₙ₋₂, F0=0, F1=1 (A000045).
  FibonacciNumbers: iterate([0n, 1n], (t) => t[t.length - 1] + t[t.length - 2], TERMS),
  // Lₙ = Lₙ₋₁ + Lₙ₋₂, L0=2, L1=1 (A000032).
  LucasNumbers: iterate([2n, 1n], (t) => t[t.length - 1] + t[t.length - 2], TERMS),
  // Jₙ = Jₙ₋₁ + 2Jₙ₋₂, J0=0, J1=1 (A001045).
  JacobsthalNumbers: iterate([0n, 1n], (t) => t[t.length - 1] + 2n * t[t.length - 2], TERMS),
  // Pₙ = 2Pₙ₋₁ + Pₙ₋₂, P0=0, P1=1 (A000129).
  PellNumbers: iterate([0n, 1n], (t) => 2n * t[t.length - 1] + t[t.length - 2], TERMS),
  // Tₙ = Tₙ₋₁ + Tₙ₋₂ + Tₙ₋₃, T0=0, T1=0, T2=1 (A000073).
  TribonacciNumbers: iterate([0n, 0n, 1n], (t) => t[t.length - 1] + t[t.length - 2] + t[t.length - 3], TERMS),
  // Pₙ = Pₙ₋₂ + Pₙ₋₃, a(0)=1, a(1)=a(2)=0 (A000931).
  PadovanSequence: iterate([1n, 0n, 0n], (t) => t[t.length - 2] + t[t.length - 3], TERMS),
  // Pₙ = Pₙ₋₂ + Pₙ₋₃, P0=3, P1=0, P2=2 (A001608).
  PerrinSequence: iterate([3n, 0n, 2n], (t) => t[t.length - 2] + t[t.length - 3], TERMS),
};

// Stern's diatomic sequence (fusc), recursive definition computed directly (no bit-doubling
// trick): s(0)=0, s(1)=1, s(2n)=s(n), s(2n+1)=s(n)+s(n+1). Memoised only to keep it fast.
const sternMemo = new Map<number, bigint>();
function sternRecursive(n: number): bigint {
  if (n === 0) return 0n;
  if (n === 1) return 1n;
  const cached = sternMemo.get(n);
  if (cached !== undefined) return cached;
  const v = n % 2 === 0 ? sternRecursive(n / 2) : sternRecursive((n - 1) / 2) + sternRecursive((n + 1) / 2);
  sternMemo.set(n, v);
  return v;
}

// Thue-Morse via the doubling definition t(2n)=t(n), t(2n+1)=1-t(n), t(0)=0 — not popcount.
function thueMorseRecursive(n: number): bigint {
  if (n === 0) return 0n;
  return n % 2 === 0 ? thueMorseRecursive(n / 2) : 1n - thueMorseRecursive((n - 1) / 2);
}

// ─── brute-force combinatorial counts, independent of the recurrences above. ───

/** #Dyck paths of semilength n (balanced parenthesizations) — should equal CatalanNumbers(n). */
function dyckPathCount(n: number): bigint {
  let count = 0n;
  const path: number[] = [];
  (function rec(open: number, close: number) {
    if (open === 0 && close === 0) {
      count += 1n;
      return;
    }
    if (open > 0) {
      path.push(1);
      rec(open - 1, close);
      path.pop();
    }
    if (close > open) {
      path.push(-1);
      rec(open, close - 1);
      path.pop();
    }
  })(n, n);
  return count;
}

/** #set partitions of an n-set, by direct restricted-growth-string enumeration —
 *  should equal BellNumbers(n). */
function setPartitionCount(n: number): bigint {
  if (n === 0) return 1n;
  let count = 0n;
  (function rec(i: number, maxUsed: number) {
    if (i === n) {
      count += 1n;
      return;
    }
    for (let v = 0; v <= maxUsed + 1; v++) rec(i + 1, Math.max(maxUsed, v));
  })(1, 0); // rgs[0] is always 0
  return count;
}

/** #integer partitions of n, by direct largest-part-first enumeration —
 *  should equal PartitionNumbers(n). */
function integerPartitionCount(n: number): bigint {
  let count = 0n;
  (function rec(remaining: number, max: number) {
    if (remaining === 0) {
      count += 1n;
      return;
    }
    for (let p = Math.min(remaining, max); p >= 1; p--) rec(remaining - p, p);
  })(n, n);
  return count;
}

/** #Motzkin paths of length n (steps up/flat/down, never below 0, end at 0) —
 *  should equal MotzkinNumbers(n). */
function motzkinPathCount(n: number): bigint {
  let count = 0n;
  (function rec(steps: number, height: number) {
    if (steps === 0) {
      if (height === 0) count += 1n;
      return;
    }
    if (height > 0) rec(steps - 1, height - 1); // down
    rec(steps - 1, height); // flat
    rec(steps - 1, height + 1); // up
  })(n, 0);
  return count;
}

// ─── kernel-level: unrank matches the independent recurrence for its first 30 terms. ───

for (const [head, terms] of Object.entries(INDEPENDENT)) {
  test(`${head} matches an independently-implemented recurrence for its first ${TERMS} terms`, () => {
    const entry = entryOf(head);
    const got = terms.map((_, r) => entry.unrank([], r));
    expect(got).toEqual(terms);
  });
}

test(`SternDiatomicSequence matches the recursive fusc definition for its first ${TERMS} terms`, () => {
  const entry = entryOf("SternDiatomicSequence");
  for (let r = 0; r < TERMS; r++) expect(entry.unrank([], r)).toBe(sternRecursive(r));
});

test(`ThueMorseNumbers matches the doubling definition for its first ${TERMS} terms`, () => {
  const entry = entryOf("ThueMorseNumbers");
  for (let r = 0; r < TERMS; r++) expect(entry.unrank([], r)).toBe(thueMorseRecursive(r));
});

// ─── brute-force checks: production terms vs. independent combinatorial counts. ───

test("CatalanNumbers matches brute-force Dyck path counts up to n=12", () => {
  const entry = entryOf("CatalanNumbers");
  for (let n = 0; n <= 12; n++) expect(entry.unrank([], n)).toBe(dyckPathCount(n));
});

test("BellNumbers matches brute-force set partition counts up to n=7", () => {
  const entry = entryOf("BellNumbers");
  for (let n = 0; n <= 7; n++) expect(entry.unrank([], n)).toBe(setPartitionCount(n));
});

test("PartitionNumbers matches brute-force integer partition counts up to n=14", () => {
  const entry = entryOf("PartitionNumbers");
  for (let n = 0; n <= 14; n++) expect(entry.unrank([], n)).toBe(integerPartitionCount(n));
});

test("MotzkinNumbers matches brute-force Motzkin path counts up to n=10", () => {
  const entry = entryOf("MotzkinNumbers");
  for (let n = 0; n <= 10; n++) expect(entry.unrank([], n)).toBe(motzkinPathCount(n));
});

// ─── OEIS first terms, hardcoded from the cited A-numbers. ───

const OEIS: Record<string, { anum: string; terms: bigint[] }> = {
  FibonacciNumbers: { anum: "A000045", terms: [0n, 1n, 1n, 2n, 3n, 5n, 8n, 13n, 21n, 34n] },
  LucasNumbers: { anum: "A000032", terms: [2n, 1n, 3n, 4n, 7n, 11n, 18n, 29n, 47n, 76n] },
  JacobsthalNumbers: { anum: "A001045", terms: [0n, 1n, 1n, 3n, 5n, 11n, 21n, 43n, 85n, 171n] },
  PellNumbers: { anum: "A000129", terms: [0n, 1n, 2n, 5n, 12n, 29n, 70n, 169n, 408n, 985n] },
  TribonacciNumbers: { anum: "A000073", terms: [0n, 0n, 1n, 1n, 2n, 4n, 7n, 13n, 24n, 44n] },
  PadovanSequence: { anum: "A000931", terms: [1n, 0n, 0n, 1n, 0n, 1n, 1n, 1n, 2n, 2n] },
  PerrinSequence: { anum: "A001608", terms: [3n, 0n, 2n, 3n, 2n, 5n, 5n, 7n, 10n, 12n] },
  SternDiatomicSequence: { anum: "A002487", terms: [0n, 1n, 1n, 2n, 1n, 3n, 2n, 3n, 1n, 4n] },
  ThueMorseNumbers: { anum: "A010060", terms: [0n, 1n, 1n, 0n, 1n, 0n, 0n, 1n, 1n, 0n] },
  CatalanNumbers: { anum: "A000108", terms: [1n, 1n, 2n, 5n, 14n, 42n, 132n, 429n, 1430n, 4862n] },
  BellNumbers: { anum: "A000110", terms: [1n, 1n, 2n, 5n, 15n, 52n, 203n, 877n, 4140n, 21147n] },
  FubiniNumbers: {
    anum: "A000670",
    terms: [1n, 1n, 3n, 13n, 75n, 541n, 4683n, 47293n, 545835n, 7087261n],
  },
  MotzkinNumbers: { anum: "A001006", terms: [1n, 1n, 2n, 4n, 9n, 21n, 51n, 127n, 323n, 835n] },
  PartitionNumbers: { anum: "A000041", terms: [1n, 1n, 2n, 3n, 5n, 7n, 11n, 15n, 22n, 30n] },
  CentralDelannoyNumbers: {
    anum: "A001850",
    terms: [1n, 3n, 13n, 63n, 321n, 1683n, 8989n, 48639n, 265729n, 1462563n],
  },
  LittleSchroderNumbers: {
    anum: "A001003",
    terms: [1n, 1n, 3n, 11n, 45n, 197n, 903n, 4279n, 20793n, 103049n],
  },
  SchroederNumbers: {
    anum: "A006318",
    terms: [1n, 2n, 6n, 22n, 90n, 394n, 1806n, 8558n, 41586n, 206098n],
  },
};

for (const [head, { anum, terms }] of Object.entries(OEIS)) {
  test(`${head} matches ${anum} for its first terms`, () => {
    const entry = entryOf(head);
    const got = terms.map((_, r) => entry.unrank([], r));
    expect(got).toEqual(terms);
  });
}

// ─── valid()/rank(): every unranked term is a member; rank(unrank(r)) lands on SOME index
// with the same value (not necessarily r itself — several of these sequences repeat an early
// term, e.g. Fibonacci's F1=F2=1, so rank returns the first occurrence). ───

for (const head of Object.keys(OEIS)) {
  test(`${head}: unranked terms are valid, and rank finds an occurrence of the same value`, () => {
    const entry = entryOf(head);
    for (let r = 0; r < TERMS; r++) {
      const element = entry.unrank([], r);
      expect(entry.valid(element, [])).toBe(true);
      const rank = entry.rank(element, []);
      expect(rank).toBeGreaterThanOrEqual(0);
      expect(entry.unrank([], rank)).toBe(element);
    }
  });
}

test("FibonacciNumbers rejects a non-member between 8 and 13", () => {
  const entry = entryOf("FibonacciNumbers");
  expect(entry.valid(10n, [])).toBe(false);
  expect(entry.rank(10n, [])).toBe(-1);
});

test("ThueMorseNumbers membership is exactly {0, 1}", () => {
  const entry = entryOf("ThueMorseNumbers");
  expect(entry.valid(0n, [])).toBe(true);
  expect(entry.valid(1n, [])).toBe(true);
  expect(entry.valid(2n, [])).toBe(false);
  expect(entry.valid(-1n, [])).toBe(false);
});

test("SternDiatomicSequence membership is every non-negative integer", () => {
  const entry = entryOf("SternDiatomicSequence");
  expect(entry.valid(0n, [])).toBe(true);
  expect(entry.valid(1n, [])).toBe(true);
  expect(entry.valid(7n, [])).toBe(true);
  expect(entry.valid(-1n, [])).toBe(false);
});

// ─── engine-level: At / Take / Count / Element through the declared CE collection handlers. ───

const ce = new ComputeEngine();
declareCollections(ce);

test("FibonacciNumbers is declared as an indexed_collection<integer>", () => {
  expect(ce.box("FibonacciNumbers").type.toString()).toBe("indexed_collection<integer>");
});

test("At(FibonacciNumbers, 1) is the first term, 0", () => {
  expect(ce.box(["At", "FibonacciNumbers", 1]).evaluate().re).toBe(0);
});

test("At(BellNumbers, 5) is Bell(4) = 15 (1-indexed At, 0-indexed term)", () => {
  expect(ce.box(["At", "BellNumbers", 5]).evaluate().re).toBe(15);
});

test("Take(CatalanNumbers, 10) gives the first ten Catalan numbers", () => {
  expect(ce.box(["Take", "CatalanNumbers", 10]).evaluate().toString()).toBe("[1,1,2,5,14,42,132,429,1430,4862]");
});

test("Take(PadovanSequence, 10) gives the first ten Padovan terms", () => {
  expect(ce.box(["Take", "PadovanSequence", 10]).evaluate().toString()).toBe("[1,0,0,1,0,1,1,1,2,2]");
});

for (const head of Object.keys(OEIS)) {
  test(`Count(${head}) is +oo`, () => {
    expect(ce.box(["Count", head]).evaluate().toString()).toBe("+oo");
  });
}

test("Element membership on FibonacciNumbers", () => {
  expect(ce.box(["Element", 21, "FibonacciNumbers"]).evaluate().toString()).toBe('"True"');
  expect(ce.box(["Element", 10, "FibonacciNumbers"]).evaluate().toString()).toBe('"False"');
});

test("Element membership on LucasNumbers", () => {
  expect(ce.box(["Element", 1, "LucasNumbers"]).evaluate().toString()).toBe('"True"');
  expect(ce.box(["Element", 5, "LucasNumbers"]).evaluate().toString()).toBe('"False"');
});

test("Element membership on ThueMorseNumbers is only 0 and 1", () => {
  expect(ce.box(["Element", 0, "ThueMorseNumbers"]).evaluate().toString()).toBe('"True"');
  expect(ce.box(["Element", 1, "ThueMorseNumbers"]).evaluate().toString()).toBe('"True"');
  expect(ce.box(["Element", 2, "ThueMorseNumbers"]).evaluate().toString()).toBe('"False"');
});

test("Element membership on SternDiatomicSequence is every non-negative integer", () => {
  expect(ce.box(["Element", 0, "SternDiatomicSequence"]).evaluate().toString()).toBe('"True"');
  expect(ce.box(["Element", 42, "SternDiatomicSequence"]).evaluate().toString()).toBe('"True"');
  expect(ce.box(["Element", -1, "SternDiatomicSequence"]).evaluate().toString()).toBe('"False"');
});

// ─── Golden JSON (AGENTS.md); regenerate with `UPDATE_NUMERIC_RECURRENCE_GOLDEN=1 vp test`. ───

const GOLDEN = fileURLToPath(new URL("./numeric-recurrence.golden.json", import.meta.url));
const updating = process.env.UPDATE_NUMERIC_RECURRENCE_GOLDEN === "1";
const golden: Record<string, string[]> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, string[]> = {};

const GOLDEN_TERMS = 40;

for (const entry of entries) {
  test(`golden: ${entry.head}`, () => {
    // bigint doesn't survive JSON.stringify, so the golden file stores decimal strings.
    const elements = Array.from({ length: GOLDEN_TERMS }, (_, r) => String(entry.unrank([], r)));
    if (updating) {
      fresh[entry.head] = elements;
      return;
    }
    expect(elements).toEqual(golden[entry.head]);
  });
}

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
});
