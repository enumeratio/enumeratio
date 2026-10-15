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

test("every other Ln is as it was", () => {
  expect(evaluate(["Ln", "PositiveInfinity"])).toBe("PositiveInfinity");
  expect(evaluate(["Ln", 1])).toBe(0);
  expect(evaluate(["Ln", "x"])).toEqual(["Ln", "x"]);
});
