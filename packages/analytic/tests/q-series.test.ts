import { readFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// QPochhammer, QFactorial, QBinomial. Held to the oracle values in q-series.golden.json,
// gathered by scripts/collect-q-series-goldens.ts from mpmath (`qp`, plus independent
// product/quotient code for the other two heads) and a Wolfram kernel (all three heads
// native there) — neither is needed to run this file.

const ce = new ComputeEngine();
declareAnalytic(ce);

interface GoldenCase {
  label: string;
  head: "QPochhammer" | "QFactorial" | "QBinomial";
  args: (number | [number, number])[];
  tol: number;
  mpmath?: number;
  wolfram?: number;
}

const goldens: GoldenCase[] = JSON.parse(
  readFileSync(new URL("./q-series.golden.json", import.meta.url), "utf8"),
);

const argExpr = (a: number | [number, number]): unknown =>
  Array.isArray(a) ? ["Rational", a[0], a[1]] : a;

test("q-series: every golden case matches the oracles under N()", () => {
  const off: string[] = [];
  for (const g of goldens) {
    const ours = ce.box([g.head, ...g.args.map(argExpr)] as never).N().re;
    expect(g.mpmath ?? g.wolfram, g.label).toBeDefined();
    for (const [name, ref] of [
      ["mpmath", g.mpmath],
      ["wolfram", g.wolfram],
    ] as const) {
      if (ref === undefined) continue;
      const err = Math.abs(ours - ref) / Math.max(1, Math.abs(ref));
      if (!(err <= g.tol)) off.push(`${g.label} vs ${name}: ours=${ours} ref=${ref}`);
    }
  }
  expect(off).toEqual([]);
});

// Exact-arithmetic cases: plain evaluate() (no N()), pinned to exact rationals/integers.
test("QPochhammer: exact rational arithmetic, no N() needed", () => {
  expect(ce.box(["QPochhammer", 2, 3, 3]).evaluate().json).toEqual(-85);
  expect(
    ce.box(["QPochhammer", ["Rational", 1, 2], ["Rational", 1, 2], 3]).evaluate().json,
  ).toEqual(["Rational", 21, 64]);
  expect(ce.box(["QPochhammer", "a", "q", 0]).evaluate().json).toEqual(1);
});

test("QFactorial: exact rational arithmetic and the q=1 reduction to n!", () => {
  expect(ce.box(["QFactorial", 3, 2]).evaluate().json).toEqual(21);
  expect(ce.box(["QFactorial", 4, 2]).evaluate().json).toEqual(315);
  expect(ce.box(["QFactorial", 3, ["Rational", 1, 2]]).evaluate().json).toEqual([
    "Rational",
    21,
    8,
  ]);
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
