import { ComputeEngine } from "@cortex-js/compute-engine";
import { parseEpsil } from "@cortex-js/compute-engine/epsil";
import { expect, test } from "vite-plus/test";
import { declareEvaluation } from "../src/index.ts";

const engine = (): ComputeEngine => {
  const ce = new ComputeEngine();
  declareEvaluation(ce);
  return ce;
};

// The notebook guide's `f(x) := x^2`: Epsil and LaTeX define the same function.
test("`f(x) := body` in Epsil defines f as the LaTeX route does", () => {
  const epsil = engine();
  epsil.box(parseEpsil("f(x) := x^2 + a")[0] as never).evaluate();
  const latex = engine();
  latex.parse("f(x)\\coloneq x^2+a").evaluate();
  const call = ["f", 3] as never;
  expect(epsil.box(call).evaluate().json).toEqual(latex.box(call).evaluate().json);
  expect(epsil.box(call).evaluate().json).toEqual(["Add", "a", 9]);
});
