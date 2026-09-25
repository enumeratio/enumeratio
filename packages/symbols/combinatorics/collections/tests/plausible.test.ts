import { expect, test } from "vite-plus/test";
import { check, checkFamily, random } from "../scripts/properties.ts";
import { runFamily } from "../scripts/run-family.ts";
import { sampleable } from "../scripts/sampleable.ts";
import { type FamilyKernel, type NumberKernel, numberKernel } from "../src/families/types.ts";

/** A correct family: the k-element prefixes of [0, n), ranked lexicographically. */
const words = (broken?: Partial<NumberKernel>): FamilyKernel =>
  numberKernel({
    head: "Words",
    paramCount: 2,
    kind: "ints",
    count: ([n, k]) => (n as number) ** (k as number),
    unrank: ([n, k], r) => {
      const digits: number[] = [];
      let rest = r;
      for (let i = 0; i < (k as number); i++) {
        digits.unshift(rest % (n as number));
        rest = Math.floor(rest / (n as number));
      }
      return digits;
    },
    rank: (element, [n]) => (element as number[]).reduce((acc, d) => acc * (n as number) + d, 0),
    valid: (element, [n, k]) =>
      Array.isArray(element) &&
      element.length === (k as number) &&
      (element as number[]).every((d) => d >= 0 && d < (n as number)),
    ...broken,
  });

const draw = random(1);

test("a correct family passes every property", () => {
  const entry = words();
  expect(checkFamily(entry, [3, 2], draw)).toBeUndefined();
  for (let rank = 0n; rank < 9n; rank++) expect(check(entry, [3, 2], rank)).toBeUndefined();
});

test("a broken round trip is caught", () => {
  // rank() off by one — the single most likely unranking bug, and invisible to a
  // spot-checked example suite that only ever looks at rank 0.
  const entry = words({
    rank: (element, [n]) => (element as number[]).reduce((a, d) => a * (n as number) + d, 0) + 1,
  });
  const failure = check(entry, [3, 2], 4n);
  expect(failure?.property).toBe("round-trip");
  expect(failure?.detail).toContain("rank(unrank(4)) = 5");
});

test("a family that rejects its own element is caught", () => {
  // The property that keeps finding real bugs on the enumeratio side, almost always at a
  // degenerate parameter rather than in the middle of the range.
  const entry = words({ valid: (element) => (element as number[])[0] !== 0 });
  const failure = check(entry, [3, 2], 1n);
  expect(failure?.property).toBe("validity");
  expect(failure?.detail).toContain("rejected its own element");
});

test("a count larger than the family is caught", () => {
  // Caught by injectivity rather than by the count property, because unranking the extra
  // rank wraps and duplicates an element before the enumeration is ever reached. Either
  // diagnosis is a failure; the cheaper one simply gets there first.
  const entry = words({ count: ([n, k]) => (n as number) ** (k as number) + 1 });
  const failure = checkFamily(entry, [3, 2], draw);
  expect(failure).toBeDefined();
  expect(["injectivity", "count"]).toContain(failure?.property);
});

test("two ranks giving one element is caught", () => {
  const entry = words({ unrank: () => [0, 0] });
  const failure = checkFamily(entry, [3, 2], draw);
  expect(failure?.property).toBe("injectivity");
});

test("a throwing kernel is a failure, not a crash", () => {
  const entry = words({
    unrank: () => {
      throw new Error("boom");
    },
  });
  expect(check(entry, [3, 2], 1n)?.property).toBe("unrank");
  const rankThrows = words({
    rank: () => {
      throw new Error("nope");
    },
  });
  expect(check(rankThrows, [3, 2], 1n)?.property).toBe("round-trip");
});

// A scalar family whose elements are bigint past a safe-integer cutoff — the shape
// NarcissisticNumbers/FactorialNumbers-style families take (issue #90: plain JSON.stringify
// throws on a bigint rather than the NaN -> null collision that hid the original bug, so the
// harness's key() needs its own bigint handling, exercised here rather than by re-testing
// NarcissisticNumbers' own kernel, which the collections tests already cover).
const bigScalars = (elements: readonly bigint[], broken?: Partial<NumberKernel>): FamilyKernel =>
  numberKernel({
    head: "BigScalars",
    paramCount: 0,
    kind: "scalar",
    count: () => elements.length,
    unrank: (_p, r) => elements[r] as unknown as number,
    rank: (element) => elements.indexOf(element as bigint),
    valid: (element) => elements.includes(element as bigint),
    ...broken,
  });

test("distinct bigint elements pass injectivity", () => {
  const entry = bigScalars([10n, 20n, 12345678901234567890n, 12345678901234567891n]);
  expect(checkFamily(entry, [], draw)).toBeUndefined();
  for (let rank = 0n; rank < 4n; rank++) expect(check(entry, [], rank)).toBeUndefined();
});

test("two ranks giving the same bigint element is still caught", () => {
  const entry = bigScalars([10n, 20n, 30n], { unrank: () => 20n as unknown as number });
  const failure = checkFamily(entry, [], draw);
  expect(failure?.property).toBe("injectivity");
});

test("a failure is shrunk along its address before it's reported", () => {
  // Broken only at the top of the range, so the sampled point is usually large; the report
  // should still name the smallest rank that reproduces it.
  const entry = words({
    rank: (element, [n]) => {
      const value = (element as number[]).reduce((a, d) => a * (n as number) + d, 0);
      return value >= 3 ? value + 1 : value;
    },
  });
  const report = runFamily(entry, { seed: 1, points: 8, maxSize: 6, budget: 10_000n, retries: 10 });
  expect(report.failures[0]?.property).toBe("round-trip");
  expect(report.failures[0]?.rank).toBe(3n);
});

test("an undeclared family's count past 2^53 is a discard, not a failure", () => {
  const huge = numberKernel({
    head: "Huge",
    paramCount: 0,
    kind: "scalar",
    count: () => 2 ** 60,
    unrank: (_p, r) => r,
    rank: (element) => element as number,
    valid: () => true,
  });
  const report = runFamily(huge, { seed: 1, points: 4, maxSize: 4, budget: 10_000n, retries: 2 });
  expect(report.failures).toEqual([]);
  expect(Object.keys(report.discards)).toEqual(["past 2^53, kernel not bigint yet"]);
});

test("numberKernel refuses past 2^53 rather than rounding", () => {
  const huge = numberKernel({
    head: "Huge",
    paramCount: 0,
    kind: "scalar",
    count: () => 2 ** 60,
    unrank: (_p, r) => r,
    rank: (element) => element as number,
    valid: () => true,
  });
  expect(() => huge.count([])).toThrow(/not bigint yet/);
  expect(() => huge.unrank([], 2n ** 60n)).toThrow(/not bigint yet/);
  expect(huge.rank(-1, [])).toBe(-1n);
});

// A sequence whose terms repeat (Fibonacci's 1, 1): rank finds the first occurrence.
const repeating = (broken?: Partial<NumberKernel>): FamilyKernel =>
  numberKernel({
    head: "Repeating",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: (_p, r) => [0, 1, 1, 2, 3, 5, 8][r] as number,
    rank: (element) => [0, 1, 1, 2, 3, 5, 8].indexOf(element as number),
    valid: (element) => [0, 1, 1, 2, 3, 5, 8].includes(element as number),
    declared: {
      carrier: "Numeric",
      params: [],
      cost: { count: "closed", unrank: "closed", rank: "closed", valid: "closed" },
      repeats: true,
    },
    ...broken,
  });

test("a declared repeat round-trips through its first occurrence", () => {
  for (let rank = 0n; rank < 7n; rank++) expect(check(repeating(), [], rank)).toBeUndefined();
  // ...and without the declaration the same kernel fails, which is what the declaration is for.
  expect(check(repeating({ declared: undefined }), [], 2n)?.property).toBe("round-trip");
});

test("a repeat pointing past its own occurrence is still caught", () => {
  const late = repeating({ rank: (element) => [0, 1, 1, 2, 3, 5, 8].lastIndexOf(element as number) });
  expect(check(late, [], 1n)?.property).toBe("round-trip");
});

test("a count that enumerates is never called past its work bound", () => {
  let counted = 0;
  const expensive = numberKernel({
    head: "Expensive",
    paramCount: 1,
    kind: "ints",
    count: ([n]) => {
      counted++;
      return n as number;
    },
    unrank: (_p, r) => [r],
    rank: (element) => (element as number[])[0] as number,
    valid: () => true,
    declared: {
      carrier: "Word",
      params: [{ name: "n", role: "axis", min: 0 }],
      cost: { count: "enumerative", unrank: "enumerative", rank: "enumerative", valid: "closed" },
      work: ([n]) => 10n ** BigInt(n as number),
    },
  });
  const instance = sampleable(expensive);
  if ("untestable" in instance) throw new Error(instance.untestable);
  // Budget 100 affords n ≤ 2 only: larger draws discard before counting.
  for (let i = 0; i < 40; i++) instance.draw(random(i), 8, 100n);
  expect(counted).toBeLessThan(40);
  const drawn = Array.from({ length: 40 }, (_, i) => instance.draw(random(i), 8, 100n));
  for (const d of drawn) if ("address" in d) expect(d.address.params[0]).toBeLessThanOrEqual(2);
});
