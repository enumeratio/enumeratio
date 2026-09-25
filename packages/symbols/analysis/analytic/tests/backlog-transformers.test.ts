import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// The backlog transformers and interval/uncertainty arithmetic landed in lane B-18. What's
// left here is Add/Multiply/Power/Subtract over Interval/CenteredInterval/Around: these
// core arithmetic heads carry no reference entry of their own to pin an example on, so their
// cases stay direct toEqual assertions against the exact MathJSON.

const ce = new ComputeEngine();
declareAnalytic(ce);

const json = (expr: unknown) => ce.box(expr as never).evaluate().json;

test("Interval: Add, Multiply, and even Power — the dependency problem widens Subtract", () => {
  expect(json(["Add", ["Interval", 1, 2], ["Interval", 3, 4]])).toEqual(["Interval", 4, 6]);
  expect(json(["Multiply", ["Interval", 1, 2], ["Interval", -1, 3]])).toEqual(["Interval", -2, 6]);
  expect(json(["Power", ["Interval", -1, 2], 2])).toEqual(["Interval", 0, 4]);
  // The dependency problem: an interval minus itself still widens.
  expect(json(["Subtract", ["Interval", 1, 2], ["Interval", 1, 2]])).toEqual(["Interval", -1, 1]);
});

test("CenteredInterval: centers and radii add under Add/Subtract, a scalar scales both", () => {
  expect(
    json(["Add", ["CenteredInterval", 1, ["Rational", 1, 2]], ["CenteredInterval", 2, ["Rational", 1, 4]]]),
  ).toEqual(["CenteredInterval", 3, ["Rational", 3, 4]]);
  expect(json(["Multiply", 2, ["CenteredInterval", 2, ["Rational", 1, 2]]])).toEqual(["CenteredInterval", 4, 1]);
  // Radii add under subtraction too — Subtract runs through Add + Negate, and Negate leaves
  // the radius alone.
  expect(
    json(["Subtract", ["CenteredInterval", 5, ["Rational", 1, 4]], ["CenteredInterval", 1, ["Rational", 1, 4]]]),
  ).toEqual(["CenteredInterval", 4, ["Rational", 1, 2]]);
});

test("Around: quadrature for Add/Power, and Multinomial's integer-only domain declines it", () => {
  expect(json(["Add", ["Around", 1, 0.1], ["Around", 2, 0.2]])).toEqual(["Around", 3, 0.223606797749979]);
  expect(json(["Power", ["Around", 2, 0.1], 2])).toEqual(["Around", 4, 0.4]);
  // Multinomial's domain is integer-only: no derivative to propagate through, so it stays put
  // in the plain engine this test builds -- @enumeratio/number-theory's own Multinomial does
  // carry an Around-aware extension (see its reference entry), just not one this package wires
  // in on its own.
  expect(json(["Multinomial", ["Around", 2, 0.01], 2])).toEqual(["Multinomial", ["Around", 2, 0.01], 2]);
});
