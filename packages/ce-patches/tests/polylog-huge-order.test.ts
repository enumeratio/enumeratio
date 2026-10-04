import { ComputeEngine, JavaScriptTarget } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { applyPatch, polyLogHugeOrder, polyLogLargeOrder } from "../src/index.ts";

const ce = new ComputeEngine();
applyPatch(ce, polyLogLargeOrder);

const n = (s: number, z: unknown) => ce.box(["PolyLog", s, z as never]).N();

// Reference values: mpmath `polylog`, 25 digits.

test("PolyLog(2500000, 4).N() returns, as 4 (native never does)", () => {
  expect(n(2_500_000, 4).re).toBeCloseTo(4, 13);
});

test("a non-integer huge order returns too", () => {
  expect(n(2_500_000.5, 4).re).toBeCloseTo(4, 13);
});

test("Li_250(4) is 4, not native's overflowed -0.25", () => {
  expect(n(250, 4).re).toBeCloseTo(4, 13);
  expect(n(250, -4).re).toBeCloseTo(-4, 13);
});

test("Li_30(-4) agrees with mpmath", () => {
  expect(n(30, -4).re).toBeCloseTo(-3.999999985099149, 13);
});

test("complex z agrees with mpmath", () => {
  const v = n(40.5, ["Complex", 2, 3]);
  expect(v.re).toBeCloseTo(1.999999999996784, 12);
  expect(v.im).toBeCloseTo(3.000000000007717, 12);
});

test("on the cut z > 1 the imaginary part is -π ln(z)^(s-1)/Γ(s)", () => {
  const k = polyLogHugeOrder(60, 1.5, 0);
  expect(k?.re).toBeCloseTo(1.5, 14);
  expect(k!.im / -1.67641689545e-103).toBeCloseTo(1, 9); // mpmath at 150 digits
});

test("the kernel declines where its remainder is not negligible", () => {
  expect(polyLogHugeOrder(3, 4, 0)).toBeUndefined(); // terms grow
  expect(polyLogHugeOrder(30, 1e9, 0)).toBeUndefined(); // cut tail 1e7
  expect(polyLogHugeOrder(2.5e6, 0.5, 0)).toBeUndefined(); // |z| <= 1: the series itself
});

test("N(x, d) past a double's digits stays unevaluated", () => {
  const v = ce.box(["N", ["PolyLog", 250, 4], 40]).evaluate();
  expect(v.operator === "PolyLog" || v.operator === "N").toBe(true);
});

test("exact PolyLog(250, 4).evaluate() stays symbolic", () => {
  expect(ce.box(["PolyLog", 250, 4]).evaluate().operator).toBe("PolyLog");
});

test("compiled JavaScript agrees, and returns at a huge order", () => {
  const fn = ce.box(["Function", ["PolyLog", "s", "z"], "s", "z"]);
  const { code } = new JavaScriptTarget().compile(fn) as { code?: string };
  // oxlint-disable-next-line no-implied-eval -- running compute-engine-compiled source is the point
  const run = new Function("_SYS", `"use strict"; return (${code});`);
  const f = run({ polyLog: () => NaN }) as (s: number, z: number) => number;
  expect(f(2_500_000, -4)).toBeCloseTo(-4, 13);
  expect(f(250.5, -4)).toBeCloseTo(-4, 13);
  expect(f(30, -4)).toBeCloseTo(-3.999999985099149, 13);
  expect(f(3_000_000, -1e5)).toBeCloseTo(-1e5, 8);
});

test("compiled JavaScript with the native helper still handles |z| <= 1", () => {
  const fn = ce.box(["Function", ["PolyLog", "s", "z"], "s", "z"]);
  const { code } = new JavaScriptTarget().compile(fn) as { code?: string };
  // oxlint-disable-next-line no-implied-eval -- running compute-engine-compiled source is the point
  const run = new Function("_SYS", `"use strict"; return (${code});`);
  const f = run({ polyLog: (_s: number, z: number) => z }) as (s: number, z: number) => number;
  expect(f(2_500_000, 0.9)).toBe(0.9);
});
