import { readFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// N(Sin(24^40)) et al. on a huge exact/bignum argument — trig-reduction.ts. Golden values
// are `wolframscript -code 'N[Sin[24^40], 30]'` (and the same for Cos/Tan/Sec/Csc/Cot, at
// each of the huge arguments below), captured with `$MaxExtraPrecision` raised so Wolfram
// doesn't decline the reduction itself. Compared to 20 digits, comfortably inside the 30
// Wolfram was asked for and the ~23 (`ce.precision` 21 + 2) this always computes to.

const ce = new ComputeEngine();
declareAnalytic(ce);

interface HugeCase {
  label: string;
  expr: unknown[];
  values: Record<string, string>;
}

interface ModerateCase {
  label: string;
  expr: unknown[];
  value: string;
}

const golden: { huge: HugeCase[]; moderate: ModerateCase[] } = JSON.parse(
  readFileSync(new URL("./trig-reduction.golden.json", import.meta.url), "utf8"),
);

const HEADS = ["Sin", "Cos", "Tan", "Sec", "Csc", "Cot"] as const;

test("Sin/Cos/Tan/Sec/Csc/Cot of a huge exact integer or rational match Wolfram", () => {
  const off: string[] = [];
  for (const c of golden.huge) {
    for (const head of HEADS) {
      const got = ce.box([head, c.expr] as never).N();
      const expected = Number(c.values[head]);
      const err = Math.abs(got.re - expected) / Math.max(Math.abs(expected), 1e-300);
      if (!(err < 1e-18)) off.push(`${head}(${c.label}): got ${got.re}, expected ${expected}`);
    }
  }
  expect(off).toEqual([]);
});

test("a huge argument's Sin/Cos/Tan/Sec/Csc/Cot stays exact and symbolic under plain evaluate()", () => {
  for (const c of golden.huge) {
    for (const head of HEADS) {
      const expr = ce.box([head, c.expr] as never).evaluate();
      expect(expr.operator).toBe(head);
    }
  }
});

test("a moderate argument is untouched -- native still handles it", () => {
  const off: string[] = [];
  for (const c of golden.moderate) {
    const got = ce.box(c.expr as never).N();
    const expected = Number(c.value);
    if (Math.abs(got.re - expected) > 1e-13) off.push(`${c.label}: got ${got.re}, expected ${expected}`);
  }
  expect(off).toEqual([]);
});

test("Tan/Sec/Csc/Cot of a huge argument are the ratios of its Sin/Cos", () => {
  // Cross-check independent of the golden file: whatever this computes for Sin and Cos,
  // the others should be exactly consistent with -- catches a copy/paste head mismatch
  // in evaluateHugeTrig's switch that the Wolfram comparison alone might not, if two heads
  // happened to agree at a particular argument.
  for (const c of golden.huge) {
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
    const expected = golden.huge[0]!.values.Sin!;
    expect(got.toString().slice(0, 40)).toBe(expected.slice(0, 40));
  } finally {
    ce.precision = saved;
  }
});
