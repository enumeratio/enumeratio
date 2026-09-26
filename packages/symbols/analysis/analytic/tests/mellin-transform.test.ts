import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// MellinTransform / InverseMellinTransform — see mellin-transform.ts for the rule table
// and its scope. Expected values are each verified against `wolframscript` directly
// (see the head's reference/*.yaml `details`), so they're inlined here rather than in a
// golden JSON file, matching this repo's other transform tables (transforms.test.ts).
// Expected shapes use compute-engine's own canonical form (`Exp(y)` canonicalizes to
// `Power(ExponentialE, y)`), read off by boxing directly rather than guessed.

const ce = new ComputeEngine();
declareAnalytic(ce);

const evalOf = (mj: unknown) => ce.box(mj as never).evaluate().json;

test("MellinTransform: the base table", () => {
  expect(evalOf(["MellinTransform", ["Exp", ["Negate", "x"]], "x", "s"])).toEqual(["Gamma", "s"]);
  expect(evalOf(["MellinTransform", ["Divide", 1, ["Add", 1, "x"]], "x", "s"])).toEqual([
    "Multiply",
    "Pi",
    ["Csc", ["Multiply", "Pi", "s"]],
  ]);
  expect(evalOf(["MellinTransform", ["Exp", ["Negate", ["Power", "x", 2]]], "x", "s"])).toEqual([
    "Multiply",
    ["Rational", 1, 2],
    ["Gamma", ["Multiply", ["Rational", 1, 2], "s"]],
  ]);
  expect(evalOf(["MellinTransform", ["Sin", "x"], "x", "s"])).toEqual([
    "Multiply",
    ["Sin", ["Multiply", ["Rational", 1, 2], "Pi", "s"]],
    ["Gamma", "s"],
  ]);
  expect(evalOf(["MellinTransform", ["Ln", ["Add", 1, "x"]], "x", "s"])).toEqual([
    "Divide",
    ["Multiply", "Pi", ["Csc", ["Multiply", "Pi", "s"]]],
    "s",
  ]);
});

test("MellinTransform: power shift and scaling", () => {
  // x^a * e^-x -> Gamma(a+s)
  expect(evalOf(["MellinTransform", ["Multiply", ["Power", "x", "a"], ["Exp", ["Negate", "x"]]], "x", "s"])).toEqual([
    "Gamma",
    ["Add", "a", "s"],
  ]);
  // 1/(1+x)^a -> Gamma(a-s)Gamma(s)/Gamma(a)
  expect(evalOf(["MellinTransform", ["Power", ["Add", 1, "x"], ["Negate", "a"]], "x", "s"])).toEqual([
    "Divide",
    ["Multiply", ["Gamma", "s"], ["Gamma", ["Add", "a", ["Negate", "s"]]]],
    ["Gamma", "a"],
  ]);
  const ce2 = new ComputeEngine();
  declareAnalytic(ce2);
  ce2.assume(ce2.box(["Greater", "a", 0]));
  const evalOf2 = (mj: unknown) => ce2.box(mj as never).evaluate().json;
  // e^(-ax) -> Gamma(s)/a^s, needs a's sign known
  expect(evalOf2(["MellinTransform", ["Exp", ["Negate", ["Multiply", "a", "x"]]], "x", "s"])).toEqual([
    "Multiply",
    ["Gamma", "s"],
    ["Power", "a", ["Negate", "s"]],
  ]);
});

test("MellinTransform: declines outside the table", () => {
  expect(evalOf(["MellinTransform", ["f", "x"], "x", "s"])).toEqual(["MellinTransform", ["f", "x"], "x", "s"]);
  expect(evalOf(["MellinTransform", ["Exp", "x"], "x", "s"])).toEqual([
    "MellinTransform",
    ["Power", "ExponentialE", "x"],
    "x",
    "s",
  ]);
});

test("InverseMellinTransform: mirrors the base table", () => {
  expect(evalOf(["InverseMellinTransform", ["Gamma", "s"], "s", "x"])).toEqual([
    "Power",
    "ExponentialE",
    ["Negate", "x"],
  ]);
  expect(evalOf(["InverseMellinTransform", ["Multiply", "Pi", ["Csc", ["Multiply", "Pi", "s"]]], "s", "x"])).toEqual([
    "Divide",
    1,
    ["Add", "x", 1],
  ]);
});

test("InverseMellinTransform: log(1+1/x), NOT log(1+x)", () => {
  expect(
    evalOf(["InverseMellinTransform", ["Divide", ["Multiply", "Pi", ["Csc", ["Multiply", "Pi", "s"]]], "s"], "s", "x"]),
  ).toEqual(["Ln", ["Add", ["Divide", 1, "x"], 1]]);
});

test("InverseMellinTransform: power shift (Gamma(a+s) -> x^a e^-x)", () => {
  expect(evalOf(["InverseMellinTransform", ["Gamma", ["Add", "a", "s"]], "s", "x"])).toEqual([
    "Multiply",
    ["Power", "ExponentialE", ["Negate", "x"]],
    ["Power", "x", "a"],
  ]);
});

test("MellinTransform / InverseMellinTransform: forward-inverse round trips agree (scaled pairs)", () => {
  const ce2 = new ComputeEngine();
  declareAnalytic(ce2);
  ce2.assume(ce2.box(["Greater", "b", 0]));
  const ev = (mj: unknown) => ce2.box(mj as never).evaluate();
  for (const f of [
    ["Exp", ["Negate", ["Multiply", "b", "x"]]],
    ["Sin", ["Multiply", "b", "x"]],
    ["Divide", 1, ["Add", 1, ["Multiply", "b", "x"]]],
  ]) {
    const F = ev(["MellinTransform", f, "x", "s"]);
    const back = ev(["InverseMellinTransform", F.json as never, "s", "x"]);
    expect(back.json).toEqual(ce2.box(f as never).json);
  }
});
