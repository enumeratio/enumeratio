import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// N(Sin(24^40)) et al. on a huge exact/bignum argument — trig-reduction.ts. Oracle
// coverage (`wolframscript -code 'N[Sin[24^40], 30]'`, and the same for
// Cos/Tan/Sec/Csc/Cot, at each of the huge arguments below, captured with
// `$MaxExtraPrecision` raised so Wolfram doesn't decline the reduction itself) now lives
// as `known` values on the reference examples (packages/reference/tests/known.test.ts).
// The huge arguments themselves stay here too, for the cross-checks below that don't need
// an oracle at all.

const ce = new ComputeEngine();
declareAnalytic(ce);

const HEADS = ["Sin", "Cos", "Tan", "Sec", "Csc", "Cot"] as const;

const huge: { label: string; expr: unknown[] }[] = [
  { label: "24^40", expr: ["Power", 24, 40] },
  { label: "10^100", expr: ["Power", 10, 100] },
  { label: "3^200", expr: ["Power", 3, 200] },
  { label: "-7^60", expr: ["Negate", ["Power", 7, 60]] },
  { label: "(10^80+1)/3", expr: ["Divide", ["Add", ["Power", 10, 80], 1], 3] },
];

const moderate: { label: string; expr: unknown[]; value: string }[] = [
  { label: "Sin(1)", expr: ["Sin", 1], value: "0.84147098480789650665" },
  { label: "Cos(2.5)", expr: ["Cos", 2.5], value: "-0.8011436155469337" },
  { label: "Tan(100)", expr: ["Tan", 100], value: "-0.58721391515692907668" },
  { label: "Sec(3)", expr: ["Sec", 3], value: "-1.01010866590799375130" },
  { label: "Csc(5)", expr: ["Csc", 5], value: "-1.04283521277140581978" },
  { label: "Cot(7)", expr: ["Cot", 7], value: "1.14751542240513568506" },
];

test("a huge argument's Sin/Cos/Tan/Sec/Csc/Cot stays exact and symbolic under plain evaluate()", () => {
  for (const c of huge) {
    for (const head of HEADS) {
      const expr = ce.box([head, c.expr] as never).evaluate();
      expect(expr.operator).toBe(head);
    }
  }
});

test("a moderate argument is untouched -- native still handles it", () => {
  const off: string[] = [];
  for (const c of moderate) {
    const got = ce.box(c.expr as never).N();
    const expected = Number(c.value);
    if (Math.abs(got.re - expected) > 1e-13) off.push(`${c.label}: got ${got.re}, expected ${expected}`);
  }
  expect(off).toEqual([]);
});

test("Tan/Sec/Csc/Cot of a huge argument are the ratios of its Sin/Cos", () => {
  // Cross-check independent of any oracle: whatever this computes for Sin and Cos, the
  // others should be exactly consistent with -- catches a copy/paste head mismatch in
  // evaluateHugeTrig's switch that a Wolfram comparison alone might not, if two heads
  // happened to agree at a particular argument.
  for (const c of huge) {
    const sin = ce.box(["Sin", c.expr] as never).N().re;
    const cos = ce.box(["Cos", c.expr] as never).N().re;
    const tan = ce.box(["Tan", c.expr] as never).N().re;
    const sec = ce.box(["Sec", c.expr] as never).N().re;
    const csc = ce.box(["Csc", c.expr] as never).N().re;
    const cot = ce.box(["Cot", c.expr] as never).N().re;
    expect(tan).toBeCloseTo(sin / cos, 12);
    expect(sec).toBeCloseTo(1 / cos, 12);
    expect(csc).toBeCloseTo(1 / sin, 12);
    expect(cot).toBeCloseTo(cos / sin, 12);
  }
});

test("raising ce.precision carries through to more digits", () => {
  const saved = ce.precision;
  try {
    ce.precision = 50;
    const got = ce.box(["Sin", ["Power", 24, 40]]).N();
    // Wolfram's N[Sin[24^40], 30] -- the same value held as Sin's `known` on its
    // "a-huge-24-40-argument-reduces-exactly-mod-2-pi" example.
    const expected = "0.4000831527197660470709419158482646956061055971916011789753";
    expect(got.toString().slice(0, 40)).toBe(expected.slice(0, 40));
  } finally {
    ce.precision = saved;
  }
});
