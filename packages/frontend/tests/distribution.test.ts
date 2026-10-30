import { expect, test } from "vite-plus/test";
import { coefficients, declineReason, equidistributed, polynomial, readTally } from "../src/distribution.ts";
import { lowerOptions } from "../src/symbols.ts";

test("a Tally answer reads as an ascending distribution", () => {
  const read = readTally(["Tuple", ["List", 2, 0, 1], ["List", 1, 1, 4]]);
  expect(read).toEqual({ ok: true, distribution: { values: [0, 1, 2], counts: [1, 4, 1] } });
  if (read.ok) {
    expect(coefficients(read.distribution)).toEqual([1, 4, 1]);
    expect(polynomial(read.distribution)).toBe("1 + 4q + q^2");
  }
});

test("a gap in the values is a zero coefficient", () => {
  const read = readTally(["Tuple", ["List", 0, 3], ["List", 2, 5]]);
  expect(read.ok && coefficients(read.distribution)).toEqual([2, 0, 0, 5]);
});

test("what is not a tally of numbers declines", () => {
  expect(readTally(["Tally", "x"]).ok).toBe(false);
  expect(readTally(["Tuple", ["List", ["List", 1]], ["List", 1]]).ok).toBe(false);
});

test("the size and row caps decline with a reason", () => {
  expect(declineReason({ size: 7, maxSize: 6 })).toContain("size 6");
  expect(declineReason({ count: 1_000_000n })).toContain("past the");
  expect(declineReason({ size: 6, maxSize: 6, count: 720n })).toBeUndefined();
});

test("equidistribution needs a size in common", () => {
  const row = (n: number, counts: number[]) => ({
    n,
    ok: true as const,
    distribution: { values: counts.map((_, i) => i), counts },
  });
  expect(equidistributed([row(2, [1, 1])], [row(2, [1, 1])])).toBe(true);
  expect(equidistributed([row(2, [1, 1])], [row(3, [1, 1])])).toBe(false);
  expect(equidistributed([row(2, [1, 1])], [row(2, [2, 0])])).toBe(false);
});

test("`Distribution -> True` becomes the table's attribute, `False` none", () => {
  expect(lowerOptions(undefined, { Distribution: "True" }).attributes).toEqual({ distribution: "true" });
  expect(lowerOptions(undefined, { Distribution: "False" }).attributes).toEqual({});
});
