import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { type AlgebraProvider, providersOf, registerAlgebra } from "../src/index.ts";

// Two toy providers, so the seam is tested rather than its clients (and so this package
// does not have to depend on the packages that depend on it).

const alpha: AlgebraProvider = {
  name: "alpha",
  dimension: (a) => (a.operator === "Alpha" ? new ComputeEngine().number(11) : undefined),
  product: (ops) => (ops.every((o) => o.operator === "Alpha") ? ops[0] : undefined),
  contains: (_e, a) => (a.operator === "Alpha" ? new ComputeEngine().symbol("True") : undefined),
};

const beta: AlgebraProvider = {
  name: "beta",
  dimension: (a) => (a.operator === "Beta" ? new ComputeEngine().number(22) : undefined),
};

const engine = (): ComputeEngine => {
  const ce = new ComputeEngine();
  ce.declare("Alpha", { signature: "(integer) -> value" });
  ce.declare("Beta", { signature: "(integer) -> value" });
  return ce;
};

test("the heads dispatch to whichever provider recognises the algebra", () => {
  const ce = engine();
  registerAlgebra(ce, alpha);
  registerAlgebra(ce, beta);
  expect(ce.box(["AlgebraDimension", ["Alpha", 1]]).evaluate().json).toBe(11);
  expect(ce.box(["AlgebraDimension", ["Beta", 1]]).evaluate().json).toBe(22);
});

test("order of registration does not matter", () => {
  const ce = engine();
  registerAlgebra(ce, beta);
  registerAlgebra(ce, alpha);
  expect(ce.box(["AlgebraDimension", ["Alpha", 1]]).evaluate().json).toBe(11);
  expect(ce.box(["AlgebraDimension", ["Beta", 1]]).evaluate().json).toBe(22);
});

test("an unrecognised algebra is left symbolic, not answered", () => {
  const ce = engine();
  registerAlgebra(ce, alpha);
  expect(ce.box(["AlgebraDimension", ["Beta", 1]]).evaluate().operator).toBe("AlgebraDimension");
  expect(ce.box(["Basis", ["Alpha", 1]]).evaluate().operator).toBe("Basis"); // alpha has no basis
});

test("registering twice does not stack duplicate providers", () => {
  const ce = engine();
  registerAlgebra(ce, alpha);
  registerAlgebra(ce, alpha);
  registerAlgebra(ce, { name: "alpha", dimension: () => ce.number(99) });
  expect(providersOf(ce).length).toBe(1);
  expect(ce.box(["AlgebraDimension", ["Alpha", 1]]).evaluate().json).toBe(11);
});

test("Element keeps its native behaviour for everything unclaimed", () => {
  const ce = engine();
  registerAlgebra(ce, alpha);
  expect(ce.box(["Element", 2, ["Alpha", 1]]).evaluate().json).toBe("True"); // claimed
  expect(ce.box(["Element", 2, "Integers"]).evaluate().json).toBe("True"); // native
  expect(ce.box(["Element", ["Divide", 1, 2], "Integers"]).evaluate().json).toBe("False");
});

test("the shared heads only exist once an algebra library registers", () => {
  const bare = new ComputeEngine();
  expect(bare.box(["AlgebraDimension", "x"]).operatorDefinition).toBeUndefined();
  registerAlgebra(bare, beta);
  expect(bare.box(["AlgebraDimension", "x"]).operatorDefinition).toBeDefined();
});
