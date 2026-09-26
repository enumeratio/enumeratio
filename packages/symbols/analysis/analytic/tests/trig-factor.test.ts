import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// TrigFactor — see trig-factor.ts for the two strategies and their scope. Expected
// values match `wolframscript`'s own `TrigFactor` up to reordering (confirmed in the
// reference `details`); every identity is also checked numerically at several points,
// including a complex one, right here rather than trusted on inspection alone.

const ce = new ComputeEngine();
declareAnalytic(ce);

const evalOf = (mj: unknown) => ce.box(mj as never).evaluate();

/** `lhs` (unfactored) and `TrigFactor(lhs)` must agree numerically at every point in
 * `points` (each a plain object of variable -> real or `Complex` substitution). */
function checkIdentity(inner: unknown, points: ReadonlyArray<Record<string, unknown>>) {
  const factored = evalOf(["TrigFactor", inner]);
  for (const point of points) {
    const lhs = evalOf(inner)
      .subs(point as never)
      .N();
    const rhs = factored.subs(point as never).N();
    const diff = Math.hypot((lhs.re ?? NaN) - (rhs.re ?? NaN), (lhs.im ?? 0) - (rhs.im ?? 0));
    expect(diff).toBeLessThan(1e-9);
  }
  return factored;
}

const complexPoint = (re: number, im: number) => ce.box(["Complex", re, im] as never);

test("TrigFactor: sin a +/- sin b", () => {
  const points = [
    { a: 0.3, b: 1.1 },
    { a: -0.7, b: 2.2 },
    { a: complexPoint(0.4, 0.9), b: 0.6 },
  ];
  const plus = checkIdentity(["Add", ["Sin", "a"], ["Sin", "b"]], points);
  expect(plus.json).toEqual([
    "Multiply",
    2,
    ["Sin", ["Multiply", ["Rational", 1, 2], ["Add", "a", "b"]]],
    ["Cos", ["Multiply", ["Rational", 1, 2], ["Add", "a", ["Negate", "b"]]]],
  ]);
  checkIdentity(["Subtract", ["Sin", "a"], ["Sin", "b"]], points);
});

test("TrigFactor: cos a +/- cos b", () => {
  const points = [
    { a: 0.3, b: 1.1 },
    { a: -0.7, b: 2.2 },
  ];
  const minus = checkIdentity(["Subtract", ["Cos", "a"], ["Cos", "b"]], points);
  expect(minus.json).toEqual([
    "Multiply",
    -2,
    ["Sin", ["Multiply", ["Rational", 1, 2], ["Add", "a", "b"]]],
    ["Sin", ["Multiply", ["Rational", 1, 2], ["Add", "a", ["Negate", "b"]]]],
  ]);
  checkIdentity(["Add", ["Cos", "a"], ["Cos", "b"]], points);
});

test("TrigFactor: 1 +/- cos x (half-angle), either operand order", () => {
  const points = [{ x: 0.5 }, { x: -1.3 }, { x: complexPoint(0.5, 0.8) }];
  const minus = checkIdentity(["Subtract", 1, ["Cos", "x"]], points);
  expect(minus.json).toEqual(["Multiply", 2, ["Power", ["Sin", ["Multiply", ["Rational", 1, 2], "x"]], 2]]);
  const plusSwapped = checkIdentity(["Add", ["Cos", "x"], 1], [{ x: 0.5 }]);
  expect(plusSwapped.json).toEqual(["Multiply", 2, ["Power", ["Cos", ["Multiply", ["Rational", 1, 2], "x"]], 2]]);
});

test("TrigFactor: a polynomial in Sin(x)/Cos(x), via Factor after substitution", () => {
  const inner = [
    "Add",
    ["Power", ["Sin", "x"], 2],
    ["Multiply", 2, ["Sin", "x"], ["Cos", "x"]],
    ["Power", ["Cos", "x"], 2],
  ];
  const factored = checkIdentity(inner, [{ x: 0.9 }, { x: complexPoint(0.2, 0.4) }]);
  expect(factored.json).toEqual(["Power", ["Add", ["Sin", "x"], ["Cos", "x"]], 2]);
});

test("TrigFactor: an already-factored product of different arguments is a fixed point; Tan declines", () => {
  // Sin(a)*Cos(b) (a != b) has nothing left to factor -- the polynomial strategy treats
  // each side as an opaque coefficient of the other and returns it unchanged.
  expect(evalOf(["TrigFactor", ["Multiply", ["Sin", "a"], ["Cos", "b"]]]).json).toEqual([
    "Multiply",
    ["Sin", "a"],
    ["Cos", "b"],
  ]);
  // Tan isn't in this file's vocabulary at all.
  expect(evalOf(["TrigFactor", ["Add", ["Tan", "x"], 1]]).json).toEqual(["TrigFactor", ["Add", ["Tan", "x"], 1]]);
});
