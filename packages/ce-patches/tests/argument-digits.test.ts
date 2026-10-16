import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { applyPatch, argumentDigits } from "../src/index.ts";

const ce = new ComputeEngine();
applyPatch(ce, argumentDigits);

const digits = (expr: unknown, d: number): string =>
  ce
    .box(["N", expr, d] as never)
    .evaluate()
    .toString();
const I: ["Complex", number, number] = ["Complex", 0, 1];

test("Argument of a complex number carries the digits asked for", () => {
  // mpmath: arg(e + i pi) = 0.857511786355846265006867750932897531838470381777
  expect(digits(["Argument", ["Add", "ExponentialE", ["Multiply", I, "Pi"]]], 30)).toBe(
    "0.857511786355846265006867750933",
  );
  // atan2(1/3, 5/2) = atan(2/15)
  expect(digits(["Argument", ["Add", ["Rational", 5, 2], ["Multiply", I, ["Rational", 1, 3]]]], 30)).toBe(
    "0.132551532296674021269917443704",
  );
});

test("a machine float, and a plain N at the engine's own precision, are as native answers them", () => {
  const bare = new ComputeEngine();
  for (const z of [
    ["Complex", 0.1, 0.2],
    ["Complex", 3, 4],
    ["Complex", -2.5, 1],
  ]) {
    const call = ["Argument", z] as never;
    expect(ce.box(call).N().json).toEqual(bare.box(call).N().json);
    expect(ce.box(call).evaluate().json).toEqual(bare.box(call).evaluate().json);
  }
});

test("N(Argument(z), d) agrees with Arctan2 for every d past a double's, not only large ones", () => {
  for (const d of [16, 20, 25, 30, 40])
    expect(digits(["Argument", ["Add", "ExponentialE", ["Multiply", I, "Pi"]]], d)).toBe(
      digits(["Arctan2", "Pi", "ExponentialE"], d),
    );
});

test("the quadrants and the real axis are as they were", () => {
  expect(digits(["Argument", ["Add", -1, ["Multiply", I, "Pi"]]], 25)).toBe("1.878965397910881555018321");
  expect(digits(["Argument", ["Negate", ["Add", "ExponentialE", ["Multiply", I, "Pi"]]]], 25)).toBe(
    "-2.284080867233946973455776",
  );
  expect(ce.box(["Argument", -3]).evaluate().json).toEqual("Pi");
  // exact in, exact out: only a numeric request past a double's digits is taken over
  expect(ce.box(["Argument", ["Complex", 1, 1]]).evaluate().json).toEqual(["Multiply", ["Rational", 1, 4], "Pi"]);
  expect(ce.box(["Argument", ["Complex", 123, -456]]).evaluate().json).toEqual(["Arctan", ["Rational", -152, 41]]);
  expect(ce.box(["Argument", ["Multiply", "PositiveInfinity", I]]).evaluate().json).toEqual("Indeterminate");
  expect(ce.box(["Argument", ["Complex", 3, 4]]).N().re).toBeCloseTo(Math.atan2(4, 3), 14);
});
