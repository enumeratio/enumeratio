import { expect, test } from "vite-plus/test";
import { check, checkFamily, random, shrink } from "../scripts/properties.ts";
import type { FamilyKernel } from "../src/families/types.ts";

/** A correct family: the k-element prefixes of [0, n), ranked lexicographically. */
const words = (broken?: Partial<FamilyKernel>): FamilyKernel => ({
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
  for (let rank = 0; rank < 9; rank++) expect(check(entry, [3, 2], rank)).toBeUndefined();
});

test("a broken round trip is caught", () => {
  // rank() off by one — the single most likely unranking bug, and invisible to a
  // spot-checked example suite that only ever looks at rank 0.
  const entry = words({
    rank: (element, [n]) => (element as number[]).reduce((a, d) => a * (n as number) + d, 0) + 1,
  });
  const failure = check(entry, [3, 2], 4);
  expect(failure?.property).toBe("round-trip");
  expect(failure?.detail).toContain("rank(unrank(4)) = 5");
});

test("a family that rejects its own element is caught", () => {
  // The property that keeps finding real bugs on the enumeratio side, almost always at a
  // degenerate parameter rather than in the middle of the range.
  const entry = words({ valid: (element) => (element as number[])[0] !== 0 });
  const failure = check(entry, [3, 2], 1);
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
  expect(check(entry, [3, 2], 1)?.property).toBe("unrank");
  const rankThrows = words({
    rank: () => {
      throw new Error("nope");
    },
  });
  expect(check(rankThrows, [3, 2], 1)?.property).toBe("round-trip");
});

test("the shrinker walks a failure down toward something readable", () => {
  // Broken only at the top of the range, so a naive report would name a large rank; the
  // shrinker should still hand back the smallest rank that reproduces it.
  const entry = words({
    valid: (element, [, k]) => (element as number[]).length === (k as number),
    rank: (element, [n]) => {
      const value = (element as number[]).reduce((a, d) => a * (n as number) + d, 0);
      return value >= 3 ? value + 1 : value;
    },
  });
  const failure = check(entry, [3, 2], 8);
  expect(failure?.property).toBe("round-trip");
  expect(shrink(entry, failure as NonNullable<typeof failure>).rank).toBe(3);
});
