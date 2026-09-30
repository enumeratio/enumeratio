import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// @enumeratio/ce-patches' infinity-args patch (Wolfram docs sweep #124) is applied LAST in
// declareAnalytic, deliberately: trig-reduction.ts's `isHugeReal` (Tan/Cot/Sec/Csc/Sin/Cos)
// tests `Math.abs(op.re) > HUGE_THRESHOLD` without also requiring finiteness, so it mis-claims
// PositiveInfinity/NegativeInfinity as a "huge" real argument, declines because it can't reduce
// an infinite value mod 2*pi, and (per `wrapOperator`'s own doc comment) returns undefined
// rather than falling through to a layer attached earlier -- silently swallowing
// infinity-args' answer if it runs first. This guards the ordering directly, at the full
// `declareAnalytic` level, not just the isolated `applyAllPatches` case ce-patches' own tests
// cover (which never exercises `isHugeReal` at all).
const ce = new ComputeEngine();
declareAnalytic(ce);

test("Tan/Cot/Sec/Csc(PositiveInfinity | NegativeInfinity) are Indeterminate, not left unevaluated", () => {
  for (const head of ["Tan", "Cot", "Sec", "Csc"]) {
    expect(ce.box([head, "PositiveInfinity"]).evaluate().json, head).toBe("Indeterminate");
    expect(ce.box([head, "NegativeInfinity"]).evaluate().json, head).toBe("Indeterminate");
  }
});

test("a genuinely huge (but finite) real argument is still reduced mod 2*pi, untouched", () => {
  // Regression guard the other way: infinity-args' predicates only match the three exact
  // infinity symbols, so a huge finite integer must still reach trig-reduction.ts's own fix.
  expect(ce.box(["N", ["Tan", ["Power", 24, 40]]]).evaluate().re).toBeCloseTo(0.436543795287244, 12);
});
