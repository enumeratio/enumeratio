import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// LaplaceTransform — see transforms.ts for the rule table and its scope, and each head's
// reference/*.yaml for the pinned closed forms. These need an assumption on a
// free symbol (`ce.assume`), which a reference example can't carry, or only checks which
// operator a declined call is left under.

const ce = new ComputeEngine();
declareAnalytic(ce);

test("LaplaceTransform: UnitStep/DiracDelta shift by a with known sign, declines with unknown sign", () => {
  const ce2 = new ComputeEngine();
  declareAnalytic(ce2);
  ce2.assume(ce2.box(["Greater", "a", 0]));
  const evalOf2 = (mj: unknown) => ce2.box(mj as never).evaluate().json;
  expect(evalOf2(["LaplaceTransform", ["UnitStep", ["Add", "t", ["Negate", "a"]]], "t", "s"])).toEqual([
    "Divide",
    ["Power", "ExponentialE", ["Negate", ["Multiply", "a", "s"]]],
    "s",
  ]);
  expect(evalOf2(["LaplaceTransform", ["DiracDelta", ["Add", "t", ["Negate", "a"]]], "t", "s"])).toEqual([
    "Power",
    "ExponentialE",
    ["Negate", ["Multiply", "a", "s"]],
  ]);
  // unknown sign: c has no assumption, so decline (stay unevaluated)
  const declined = ce.box(["LaplaceTransform", ["UnitStep", ["Add", "t", ["Negate", "c"]]], "t", "s"]).evaluate();
  expect(declined.operator).toBe("LaplaceTransform");
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
