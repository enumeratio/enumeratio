import { createEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

const ce = createEngine(declareAnalytic);
const run = (expr: unknown) => ce.box(expr as never).evaluate().json;

test("Refine decides a membership claim from its assumptions", () => {
  const positive = ["And", ["Greater", "x", 0], ["Greater", "y", 0]];
  const real = (e: unknown) => ["Refine", ["Element", e, "RealNumbers"], positive];
  expect(run(real(["Add", ["Power", "x", "y"], ["Ln", ["Add", "x", "y"]]]))).toBe("True");
  expect(run(real("x"))).toBe("True");
  // Nothing says z is real, so the claim stays.
  expect(run(["Refine", ["Element", "z", "RealNumbers"], positive])).toEqual(["Element", "z", "RealNumbers"]);
});

test("Refine leaves a membership claim the assumptions don't settle", () => {
  // y is free (possibly complex), x is not known an integer, x - 5 may be negative.
  const stays = (claim: unknown, cond: unknown) => {
    const result = run(["Refine", claim, cond]);
    expect(Array.isArray(result) && result[0]).toBe("Element");
    expect(result).not.toBe("False");
  };
  stays(["Element", ["Power", "x", "y"], "RealNumbers"], ["Greater", "x", 0]);
  stays(["Element", "x", "Integers"], ["Greater", "x", 0]);
  stays(["Element", ["Sqrt", ["Subtract", "x", 5]], "RealNumbers"], ["Greater", "x", 0]);
  // The sharper assumption settles the last one.
  expect(run(["Refine", ["Element", ["Sqrt", ["Subtract", "x", 5]], "RealNumbers"], ["Greater", "x", 5]])).toBe("True");
});
