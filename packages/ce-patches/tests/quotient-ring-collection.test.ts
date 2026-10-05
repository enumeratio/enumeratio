import { ComputeEngine } from "@cortex-js/compute-engine";
import { bigIntegerAt } from "@enumeratio/engine";
import { expect, test } from "vite-plus/test";
import { applyPatch, quotientRingCollection } from "../src/index.ts";

const ce = new ComputeEngine();
applyPatch(ce, quotientRingCollection);

test("Count(ℤ/mℤ) is exact past 2^53", () => {
  const m = 2n ** 61n - 1n;
  const count = ce.box(["Count", ["QuotientRing", "Integers", ce.number(m).json]]).evaluate();
  expect(bigIntegerAt(count)).toBe(m);
  expect(ce.box(["Count", ["QuotientRing", "Integers", 2 ** 53 - 1]]).evaluate().json).toBe(2 ** 53 - 1);
});

test("a small, symbolic or non-integer ring is the native one", () => {
  expect(ce.box(["Count", ["QuotientRing", "Integers", 12]]).evaluate().json).toBe(12);
  expect(ce.box(["Count", ["QuotientRing", "Integers", "n"]]).evaluate().operator).toBe("Count");
  expect(ce.box(["Count", ["QuotientRing", "Rationals", 2]]).evaluate().operator).toBe("Count");
});
