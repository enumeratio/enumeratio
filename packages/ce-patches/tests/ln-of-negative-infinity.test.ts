import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { applyPatch, lnOfNegativeInfinity } from "../src/index.ts";

const ce = new ComputeEngine();
applyPatch(ce, lnOfNegativeInfinity);

const evaluate = (expr: unknown): unknown => ce.box(expr as never).evaluate().json;

test("Ln(-oo) is +oo, exact and numeric", () => {
  expect(evaluate(["Ln", "NegativeInfinity"])).toBe("PositiveInfinity");
  expect(ce.box(["Ln", ["Negate", "PositiveInfinity"]] as never).evaluate().json).toBe("PositiveInfinity");
  expect(ce.box(["N", ["Ln", "NegativeInfinity"]] as never).evaluate().json).toBe("PositiveInfinity");
});

test("Log(-oo) and Log(-oo, b) at a real base above 1 are +oo; other bases are left alone", () => {
  expect(evaluate(["Log", "NegativeInfinity"])).toBe("PositiveInfinity");
  expect(evaluate(["Log", "NegativeInfinity", 2])).toBe("PositiveInfinity");
  expect(evaluate(["Log", "NegativeInfinity", 2.5])).toBe("PositiveInfinity");
  expect(evaluate(["Log", "NegativeInfinity", ["Rational", 1, 2]])).toEqual([
    "Log",
    "NegativeInfinity",
    ["Rational", 1, 2],
  ]);
  expect(evaluate(["Log", "NegativeInfinity", 1])).not.toBe("PositiveInfinity");
  expect(evaluate(["Log", "PositiveInfinity", 2])).toBe("PositiveInfinity");
  expect(evaluate(["Log", 8, 2])).toBe(3);
});

test("every other Ln is as it was", () => {
  expect(evaluate(["Ln", "PositiveInfinity"])).toBe("PositiveInfinity");
  expect(evaluate(["Ln", 1])).toBe(0);
  expect(evaluate(["Ln", "x"])).toEqual(["Ln", "x"]);
});
