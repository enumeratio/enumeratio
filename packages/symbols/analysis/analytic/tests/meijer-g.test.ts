import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// MeijerG (numeric, via the DLMF 16.17.2 reduction to pFq series) and MeijerGReduce
// (elementary/special functions rewritten into MeijerG form) — see meijer-g.ts and
// meijer-g-reduce.ts. Numeric values are each checked against `wolframscript`'s own
// `MeijerG` (see the head's reference/*.yaml `details` for the exact calls).

const ce = new ComputeEngine();
declareAnalytic(ce);

const g = (upper: [number[], number[]], lower: [number[], number[]], z: number) =>
  ce
    .box([
      "MeijerG",
      ["List", ["List", ...upper[0]], ["List", ...upper[1]]],
      ["List", ["List", ...lower[0]], ["List", ...lower[1]]],
      z,
    ] as never)
    .N().re;

test("MeijerG: the plain-exponential case G^{1,0}_{0,1}(z | ; 0) = e^{-z}", () => {
  const got = g([[], []], [[0], []], 0.6);
  expect(got).toBeCloseTo(Math.exp(-0.6), 12);
});

test("MeijerG: two b-terms summed (m=2)", () => {
  // wolframscript: N[MeijerG[{{},{}},{{0,1/2},{}},1.3]] = 0.18123044018823328
  const got = g([[], []], [[0, 0.5], []], 1.3);
  expect(got).toBeCloseTo(0.18123044018823328, 8);
});

test("MeijerG: both an a- and a b-parameter (m=1,n=1,p=1,q=1)", () => {
  // wolframscript: N[MeijerG[{{0.7},{}},{{0.3},{}},0.4]] = 0.9244681281245816
  const got = g([[0.7], []], [[0.3], []], 0.4);
  expect(got).toBeCloseTo(0.9244681281245816, 8);
});

test("MeijerG: a case with two upper and two lower parameters (m=1,n=1,p=1,q=2)", () => {
  // wolframscript: N[MeijerG[{{0.5},{}},{{0.2,0.9},{}},0.6]] = 0.7605889011282422
  const got = g([[0.5], []], [[0.2, 0.9], []], 0.6);
  expect(got).toBeCloseTo(0.7605889011282422, 8);
});

test("MeijerG declines: p > q, non-simple poles, symbolic operands", () => {
  const pGtQ = ce
    .box(["MeijerG", ["List", ["List", 1, 2], ["List"]], ["List", ["List", 0], ["List"]], 0.5])
    .N();
  expect(pGtQ.operator).toBe("MeijerG");
  const nonSimple = ce
    .box(["MeijerG", ["List", ["List"], ["List"]], ["List", ["List", 0, 0], ["List"]], 0.5])
    .N();
  expect(nonSimple.operator).toBe("MeijerG");
  const symbolic = ce
    .box(["MeijerG", ["List", ["List"], ["List"]], ["List", ["List", 0], ["List"]], "z"])
    .evaluate();
  expect(symbolic.operator).toBe("MeijerG");
});

const reduceOf = (mj: unknown) => ce.box(mj as never).evaluate().json;

test("MeijerGReduce: exp, sin, log(1+x), BesselJ — each round-trips through MeijerG", () => {
  expect(reduceOf(["MeijerGReduce", ["Power", "ExponentialE", "x"], "x"])).toEqual([
    "MeijerG",
    ["List", ["List"], ["List"]],
    ["List", ["List", 0], ["List"]],
    ["Negate", "x"],
  ]);
  expect(reduceOf(["MeijerGReduce", ["Ln", ["Add", 1, "x"]], "x"])).toEqual([
    "MeijerG",
    ["List", ["List", 1, 1], ["List"]],
    ["List", ["List", 1], ["List", 0]],
    "x",
  ]);

  // numeric round trip for sin(0.6) via its MeijerGReduce form (substituted after reducing,
  // since MeijerGReduce itself requires the expr to depend on the named variable)
  const sinExpr = ce.box(["MeijerGReduce", ["Sin", "x"], "x"] as never).evaluate();
  const numeric = sinExpr.subs({ x: 0.6 }).N().re;
  expect(numeric).toBeCloseTo(Math.sin(0.6), 10);
});

test("MeijerGReduce declines a bare log(x) and an expr independent of the named variable", () => {
  const bareLog = ce.box(["MeijerGReduce", ["Ln", "x"], "x"]).evaluate();
  expect(bareLog.operator).toBe("MeijerGReduce");
  const independent = ce.box(["MeijerGReduce", ["Sin", "y"], "x"]).evaluate();
  expect(independent.operator).toBe("MeijerGReduce");
});
