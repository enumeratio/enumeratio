import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// LaplaceTransform / InverseLaplaceTransform / FourierTransform / InverseFourierTransform —
// see transforms.ts for the rule table and its scope. Expected values are each verified
// against `wolframscript` directly (see the head's reference/*.yaml `details`), so they're
// inlined here rather than in a golden JSON file — a handful of small, exact, structural
// MathJSON comparisons, not numeric goldens.

const ce = new ComputeEngine();
declareAnalytic(ce);

const evalOf = (mj: unknown) => ce.box(mj as never).evaluate().json;

test("LaplaceTransform: powers, exponentials, trig, and the first shifting theorem", () => {
  expect(evalOf(["LaplaceTransform", ["Power", "t", 3], "t", "s"])).toEqual([
    "Divide",
    6,
    ["Power", "s", 4],
  ]);
  expect(
    evalOf(["LaplaceTransform", ["Power", "ExponentialE", ["Multiply", 2, "t"]], "t", "s"]),
  ).toEqual(["Divide", 1, ["Add", "s", -2]]);
  expect(evalOf(["LaplaceTransform", ["Sin", ["Multiply", 3, "t"]], "t", "s"])).toEqual([
    "Divide",
    3,
    ["Add", ["Power", "s", 2], 9],
  ]);
  // first shifting theorem: t^3 e^{2t} -> shift s -> s-2 in L{t^3}
  expect(
    evalOf([
      "LaplaceTransform",
      ["Multiply", ["Power", "ExponentialE", ["Multiply", 2, "t"]], ["Power", "t", 3]],
      "t",
      "s",
    ]),
  ).toEqual(["Divide", 6, ["Power", ["Add", "s", -2], 4]]);
  expect(
    evalOf([
      "LaplaceTransform",
      ["Multiply", ["Power", "ExponentialE", ["Multiply", 2, "t"]], ["Sin", ["Multiply", 3, "t"]]],
      "t",
      "s",
    ]),
  ).toEqual(["Divide", 3, ["Add", ["Power", ["Add", "s", -2], 2], 9]]);
});

test("LaplaceTransform: UnitStep/DiracDelta shift by a with known sign, declines with unknown sign", () => {
  const ce2 = new ComputeEngine();
  declareAnalytic(ce2);
  ce2.assume(ce2.box(["Greater", "a", 0]));
  const evalOf2 = (mj: unknown) => ce2.box(mj as never).evaluate().json;
  expect(
    evalOf2(["LaplaceTransform", ["UnitStep", ["Add", "t", ["Negate", "a"]]], "t", "s"]),
  ).toEqual(["Divide", ["Power", "ExponentialE", ["Negate", ["Multiply", "a", "s"]]], "s"]);
  expect(
    evalOf2(["LaplaceTransform", ["DiracDelta", ["Add", "t", ["Negate", "a"]]], "t", "s"]),
  ).toEqual(["Power", "ExponentialE", ["Negate", ["Multiply", "a", "s"]]]);
  // unknown sign: c has no assumption, so decline (stay unevaluated)
  const declined = ce
    .box(["LaplaceTransform", ["UnitStep", ["Add", "t", ["Negate", "c"]]], "t", "s"])
    .evaluate();
  expect(declined.operator).toBe("LaplaceTransform");
});

test("InverseLaplaceTransform: the small dictionary of images", () => {
  expect(evalOf(["InverseLaplaceTransform", ["Power", "s", -2], "s", "t"])).toEqual("t");
  expect(
    evalOf(["InverseLaplaceTransform", ["Power", ["Add", "s", ["Negate", "a"]], -1], "s", "t"]),
  ).toEqual(["Power", "ExponentialE", ["Multiply", "a", "t"]]);
  expect(
    evalOf([
      "InverseLaplaceTransform",
      ["Divide", "s", ["Add", ["Power", "s", 2], ["Power", "a", 2]]],
      "s",
      "t",
    ]),
  ).toEqual(["Cos", ["Multiply", "a", "t"]]);
});

test("FourierTransform: impulse, Gaussian, cosine (default FourierParameters {0,1})", () => {
  expect(evalOf(["FourierTransform", ["DiracDelta", "t"], "t", "w"])).toEqual([
    "Sqrt",
    ["Divide", 1, ["Multiply", 2, "Pi"]],
  ]);
  expect(
    evalOf([
      "FourierTransform",
      ["Power", "ExponentialE", ["Negate", ["Power", "t", 2]]],
      "t",
      "w",
    ]),
  ).toEqual([
    "Multiply",
    ["Divide", ["Sqrt", 2], 2],
    ["Power", "ExponentialE", ["Multiply", ["Rational", -1, 4], ["Power", "w", 2]]],
  ]);
  expect(evalOf(["FourierTransform", ["Cos", ["Multiply", "a", "t"]], "t", "w"])).toEqual([
    "Multiply",
    ["Divide", ["Sqrt", 2], 2],
    ["Add", ["DiracDelta", ["Add", "a", "w"]], ["DiracDelta", ["Add", ["Negate", "a"], "w"]]],
    ["Sqrt", "Pi"],
  ]);
});

test("InverseFourierTransform: the two unconditional closed forms", () => {
  expect(evalOf(["InverseFourierTransform", ["DiracDelta", "w"], "w", "t"])).toEqual([
    "Sqrt",
    ["Divide", 1, ["Multiply", 2, "Pi"]],
  ]);
  expect(evalOf(["InverseFourierTransform", 1, "w", "t"])).toEqual(["Sqrt", ["Multiply", 2, "Pi"]]);
});

test("declines outside the table rather than guessing", () => {
  // opaque function
  const f1 = ce.box(["LaplaceTransform", ["Sin", "t"], "t", "s"]);
  expect(f1.evaluate().operator).toBe("Divide"); // this one IS covered — sanity check the negative below differs
  const declined = ce.box(["LaplaceTransform", ["f", "t"], "t", "s"]).evaluate();
  expect(declined.operator).toBe("LaplaceTransform");
  // a product of two independently-transformable, non-exponential pieces
  const declinedProduct = ce
    .box(["LaplaceTransform", ["Multiply", ["Power", "t", 2], ["Sin", "t"]], "t", "s"])
    .evaluate();
  expect(declinedProduct.operator).toBe("LaplaceTransform");
});
