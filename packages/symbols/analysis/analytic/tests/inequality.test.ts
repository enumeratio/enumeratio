import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// Inequality(v1, rel1, v2, rel2, ...) -- Wolfram's chained-comparison form. Exact symbolic
// and boolean identities throughout, not a golden file -- see inequality.ts.

const ce = new ComputeEngine();
declareAnalytic(ce);

const evalJson = (expr: unknown) => ce.box(expr as never).evaluate().json;

test("a two-link numeric chain folds to True", () => {
  expect(evalJson(["Inequality", 0, "LessEqual", 2, "Less", 5])).toEqual("True");
});

test("a two-link numeric chain folds to False when either link fails", () => {
  expect(evalJson(["Inequality", 0, "LessEqual", 5, "Less", 5])).toEqual("False");
  expect(evalJson(["Inequality", 5, "LessEqual", 0, "Less", 5])).toEqual("False");
});

test("a symbolic mixed chain simplifies to And of its pairwise links", () => {
  expect(evalJson(["Inequality", 0, "LessEqual", "x", "Less", 5])).toEqual([
    "And",
    ["LessEqual", 0, "x"],
    ["Less", "x", 5],
  ]);
});

test("a homogeneous chain (same relation throughout) still goes through And here", () => {
  // Write it as Less(0, x, 5) directly for compute-engine's own native n-ary chain.
  expect(evalJson(["Inequality", 0, "Less", "x", "Less", 5])).toEqual(["And", ["Less", 0, "x"], ["Less", "x", 5]]);
});

test("a three-link chain conjoins every consecutive pair", () => {
  expect(evalJson(["Inequality", 1, "Less", 2, "LessEqual", 2, "Less", 10])).toEqual("True");
  expect(evalJson(["Inequality", 1, "Less", 2, "LessEqual", 1, "Less", 10])).toEqual("False");
});

test("Equal and NotEqual are valid links", () => {
  expect(evalJson(["Inequality", 2, "Equal", 2, "Less", 5])).toEqual("True");
  expect(evalJson(["Inequality", 0, "Less", "x", "NotEqual", 3])).toEqual([
    "And",
    ["Less", 0, "x"],
    ["NotEqual", "x", 3],
  ]);
});

test("declines on an even argument count", () => {
  expect(evalJson(["Inequality", 0, "Less", "x", "Less"])).toEqual(["Inequality", 0, "Less", "x", "Less"]);
});

test("declines when a link isn't one of the six relations", () => {
  expect(evalJson(["Inequality", 0, "Add", 5])).toEqual(["Inequality", 0, "Add", 5]);
});

test("a single link behaves exactly like the two-argument relation", () => {
  expect(evalJson(["Inequality", 0, "Less", "x"])).toEqual(["Less", 0, "x"]);
});
