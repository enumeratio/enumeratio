import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// QPochhammer, QFactorial, QBinomial — all three carry mapped wolfram bindings, so the
// oracle scan cross-checks their reference examples against a Wolfram kernel directly.

const ce = new ComputeEngine();
declareAnalytic(ce);

// Exact-arithmetic cases: plain evaluate() (no N()), pinned to exact rationals/integers.
test("QPochhammer: exact rational arithmetic, no N() needed", () => {
  expect(ce.box(["QPochhammer", 2, 3, 3]).evaluate().json).toEqual(-85);
  expect(ce.box(["QPochhammer", ["Rational", 1, 2], ["Rational", 1, 2], 3]).evaluate().json).toEqual([
    "Rational",
    21,
    64,
  ]);
  expect(ce.box(["QPochhammer", "a", "q", 0]).evaluate().json).toEqual(1);
});

test("QFactorial: exact rational arithmetic and the q=1 reduction to n!", () => {
  expect(ce.box(["QFactorial", 3, 2]).evaluate().json).toEqual(21);
  expect(ce.box(["QFactorial", 4, 2]).evaluate().json).toEqual(315);
  expect(ce.box(["QFactorial", 3, ["Rational", 1, 2]]).evaluate().json).toEqual(["Rational", 21, 8]);
  expect(ce.box(["QFactorial", 5, 1]).evaluate().json).toEqual(120);
});

test("QBinomial: exact rational arithmetic and the q=1 reduction to Binomial", () => {
  expect(ce.box(["QBinomial", 4, 2, 2]).evaluate().json).toEqual(35);
  expect(ce.box(["QBinomial", 6, 3, 1]).evaluate().json).toEqual(20);
  expect(ce.box(["QBinomial", 5, 2, 3]).evaluate().json).toEqual(1210);
});

test("QFactorial/QBinomial expand to a genuine polynomial for symbolic q", () => {
  expect(ce.box(["Expand", ["QFactorial", 3, "q"]]).evaluate().json).toEqual([
    "Add",
    ["Power", "q", 3],
    ["Multiply", 2, ["Power", "q", 2]],
    ["Multiply", 2, "q"],
    1,
  ]);
  expect(ce.box(["Expand", ["QBinomial", 4, 2, "q"]]).evaluate().json).toEqual([
    "Add",
    ["Power", "q", 4],
    ["Power", "q", 3],
    ["Multiply", 2, ["Power", "q", 2]],
    "q",
    1,
  ]);
});
