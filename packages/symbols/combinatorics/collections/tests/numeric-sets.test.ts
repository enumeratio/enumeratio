import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { entries as numericSets } from "../src/families/numeric-sets.ts";
import { declareCollections } from "../src/library.ts";

// First terms per OEIS, used both to brute-force certify the kernels below and to ground
// the CE-level At/Take checks further down.
const OEIS: Record<string, { anum: string; terms: number[] }> = {
  Primes: { anum: "A000040", terms: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29] },
  SquareNumbers: { anum: "A000290", terms: [1, 4, 9, 16, 25, 36, 49, 64, 81, 100] },
  AbundantNumbers: { anum: "A005101", terms: [12, 18, 20, 24, 30, 36, 40, 42, 48, 54] },
};
// A002473, 7-smooth numbers (every prime factor <= 7); SmoothNumbers(7).
const SMOOTH_7 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15, 16, 18, 20, 21];

const byHead = new Map(numericSets.map((e) => [e.head, e]));

// --- kernel-level: brute-force the first N terms against OEIS, and round-trip rank/unrank/valid. ---

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

  test(`${head} rejects non-members`, () => {
    expect(entry).toBeDefined();
    if (!entry) return;
    // A value adjacent to (but not in) the first few terms is never itself a term.
    const nonMember = Math.max(...terms) + 1;
    if (!terms.includes(nonMember)) {
      expect(entry.valid(nonMember, [])).toBe(false);
      expect(entry.rank(nonMember, [])).toBe(-1);
    }
  });
}

test("SmoothNumbers(7) matches A002473 for its first terms", () => {
  const entry = byHead.get("SmoothNumbers");
  expect(entry).toBeDefined();
  if (!entry) return;
  const got = SMOOTH_7.map((_, r) => entry.unrank([7], r));
  expect(got).toEqual(SMOOTH_7);
  for (let r = 0; r < SMOOTH_7.length; r++) {
    const element = entry.unrank([7], r);
    expect(entry.valid(element, [7])).toBe(true);
    expect(entry.rank(element, [7])).toBe(r);
  }
});

test("SmoothNumbers(7) excludes an 11-smooth-only value", () => {
  const entry = byHead.get("SmoothNumbers");
  expect(entry).toBeDefined();
  if (!entry) return;
  expect(entry.valid(11, [7])).toBe(false); // 11 is prime and > 7
  expect(entry.valid(22, [7])).toBe(false); // 22 = 2 * 11
});

// --- engine-level: At / Take / Count / Element through the declared CE collection handlers. ---

const ce = new ComputeEngine();
declareCollections(ce);

test("Primes is declared as an indexed_collection<integer>", () => {
  expect(ce.box("Primes").type.toString()).toBe("indexed_collection<integer>");
});

test("At(Primes, n) gives the n-th prime, 1-indexed", () => {
  expect(ce.box(["At", "Primes", 5]).evaluate().re).toBe(11);
});

// Take against a lazy collection stays a symbolic `Take(...)` node under `.evaluate().json`
// (only the string serializer materializes it) -- true for every family in this package, not
// just these, so assertions below read the rendered string rather than `.json`.
test("Take(Primes, 5) gives the first five primes", () => {
  expect(ce.box(["Take", "Primes", 5]).evaluate().toString()).toBe("[2,3,5,7,11]");
});

test("Count(Primes) is +oo", () => {
  expect(ce.box(["Count", "Primes"]).evaluate().toString()).toBe("+oo");
});

test("Element membership on Primes", () => {
  expect(ce.box(["Element", 11, "Primes"]).evaluate().toString()).toBe('"True"');
  expect(ce.box(["Element", 9, "Primes"]).evaluate().toString()).toBe('"False"');
});

test("Take(SquareNumbers, 5) gives the first five squares", () => {
  expect(ce.box(["Take", "SquareNumbers", 5]).evaluate().toString()).toBe("[1,4,9,16,25]");
});

test("Take(AbundantNumbers, 5) gives the first five abundant numbers", () => {
  expect(ce.box(["Take", "AbundantNumbers", 5]).evaluate().toString()).toBe("[12,18,20,24,30]");
});

test("Element membership on AbundantNumbers", () => {
  expect(ce.box(["Element", 12, "AbundantNumbers"]).evaluate().toString()).toBe('"True"');
  expect(ce.box(["Element", 28, "AbundantNumbers"]).evaluate().toString()).toBe('"False"'); // perfect, not abundant
});

test("SmoothNumbers(k) is a one-parameter operator", () => {
  expect(ce.box(["At", ["SmoothNumbers", 7], 1]).evaluate().re).toBe(1);
  expect(
    ce
      .box(["Take", ["SmoothNumbers", 7], 10])
      .evaluate()
      .toString(),
  ).toBe(`[${SMOOTH_7.slice(0, 10).join(",")}]`);
});

test("SmoothNumbers(k) below 2 is just {1}, finite", () => {
  const entry = byHead.get("SmoothNumbers");
  if (!entry) throw new Error("SmoothNumbers missing");
  for (const k of [0, 1]) {
    expect(entry.count([k])).toBe(1);
    expect(entry.unrank([k], 0)).toBe(1);
    expect(entry.unrank([k], 1)).toBeNaN(); // declines rather than scanning forever
  }
  expect(ce.box(["Count", ["SmoothNumbers", 1]]).evaluate().re).toBe(1);
});
