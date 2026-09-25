import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareKernel } from "../src/declare.ts";

const bare = new ComputeEngine();
const ce = new ComputeEngine();
declareKernel(ce);

type Expr = number | string | readonly [string, ...Expr[]];
const same = (input: Expr, expected: Expr) =>
  expect(ce.box(input).evaluate().json).toEqual(ce.box(expected).evaluate().json);
const L = (...xs: Expr[]): Expr => ["List", ...xs];

test("First and Last take a default for an empty collection", () => {
  same(["First", L(), 99], 99);
  same(["Last", L(), 99], 99);
  same(["First", L(5, 6), 99], 5);
  same(["Last", L(5, 6), 99], 6);
  same(["First", L()], "Missing"); // no default: native
});

test("Ordering keeps the first n positions, or the last −n", () => {
  const xs = L(2, 6, 1, 9, 1, 2, 3);
  same(["Ordering", xs, 4], L(3, 5, 1, 6));
  same(["Ordering", xs, -2], L(2, 4));
  same(["Ordering", L(3, 1, 2)], L(2, 3, 1)); // native
});

test("Mean and Median of a matrix go column by column", () => {
  same(["Mean", L(L(1, 10), L(2, 20), L(3, 30))], L(2, 20));
  same(["Median", L(L(1, 11, 3), L(4, 6, 7))], L(["Rational", 5, 2], ["Rational", 17, 2], 5));
  same(["Mean", L(1, 2, 3)], 2); // native
});

test("Clamp(x) clips to [−1, 1]", () => {
  same(["Clamp", 1.5], 1);
  same(["Clamp", -3], -1);
  same(["Clamp", 0.5], 0.5);
});

test("the length of a number is 0; an unknown symbol stays standing", () => {
  same(["Length", 5], 0);
  expect(ce.box(["Length", "x"]).evaluate().json).toEqual(["Length", "x"]);
});

test("ln of a negative rational is ln of its absolute value plus iπ", () => {
  same(["Ln", -1], ["Multiply", "ImaginaryUnit", "Pi"]);
  same(["Ln", -2], ["Add", ["Ln", 2], ["Multiply", "ImaginaryUnit", "Pi"]]);
  // And the exact value is the one N() already gave.
  const exact = ce
    .box(["Ln", ["Rational", -1, 2]])
    .evaluate()
    .N();
  const numeric = bare.box(["Ln", ["Rational", -1, 2]]).N();
  expect(exact.re).toBeCloseTo(numeric.re, 12);
  expect(exact.im).toBeCloseTo(numeric.im, 12);
});

test("every answer compute-engine already gives is unchanged", () => {
  for (const input of [
    ["First", L(1, 2, 3)],
    ["Last", L()],
    ["Ordering", L(3, 1, 2)],
    ["Mean", L(1, 2, 3, 4)],
    ["Median", L(1, 2, 3, 4)],
    ["Clamp", 5, 0, 3],
    ["Length", L(1, 2)],
    ["Ln", 1],
    ["Ln", 2],
    ["Ln", "ExponentialE"],
  ] as const) {
    expect(ce.box(input).evaluate().json, JSON.stringify(input)).toEqual(
      bare.box(input).evaluate().json,
    );
  }
});
