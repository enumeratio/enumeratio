import { readFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import type { BoxedExpression } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// The Wolfram signal / piecewise-waveform family (signals.ts). Every case here is exact
// (rational in, rational out), so the golden file is checked with `.isSame`, not a numeric
// tolerance -- unlike elementary.test.ts's Gudermannian/Hyperfactorial cases, there is no
// oracle drift to budget for. `Clip` is not tested here: it is answered by compute-engine's
// native `Clamp`, exercised in packages/symbols/combinatorics/collections/tests instead.

interface GoldenCase {
  label: string;
  expr: unknown[];
  expected: unknown;
}

const ce = new ComputeEngine();
declareAnalytic(ce);

const goldens: GoldenCase[] = JSON.parse(readFileSync(new URL("./signals.golden.json", import.meta.url), "utf8"));

test("signals: every golden case evaluates exactly", () => {
  const off: string[] = [];
  for (const g of goldens) {
    const got = ce.box(g.expr as never).evaluate();
    const want = ce.box(g.expected as never).evaluate();
    if (!got.isSame(want)) off.push(`${g.label}: got ${got.toString()}, want ${want.toString()}`);
  }
  expect(off).toEqual([]);
});

test("HeavisideTheta(0), HeavisidePi(±1/2) and DiracDelta(0) stay unevaluated", () => {
  expect(ce.box(["HeavisideTheta", 0]).evaluate().operator).toBe("HeavisideTheta");
  expect(ce.box(["HeavisidePi", ["Rational", 1, 2]]).evaluate().operator).toBe("HeavisidePi");
  expect(ce.box(["HeavisidePi", ["Rational", -1, 2]]).evaluate().operator).toBe("HeavisidePi");
  expect(ce.box(["DiracDelta", 0]).evaluate().operator).toBe("DiracDelta");
});

test("UnitStep(0) = 1, unlike HeavisideTheta(0)", () => {
  expect(ce.box(["UnitStep", 0]).evaluate().isSame(1)).toBe(true);
  expect(ce.box(["HeavisideTheta", 0]).evaluate().operator).toBe("HeavisideTheta");
});

test("symbolic arguments stay unevaluated", () => {
  const heads = [
    "UnitBox",
    "UnitTriangle",
    "HeavisideTheta",
    "HeavisideLambda",
    "HeavisidePi",
    "Ramp",
    "SawtoothWave",
    "TriangleWave",
    "SquareWave",
    "DiracDelta",
    "DiscreteDelta",
  ];
  for (const head of heads) {
    const r = ce.box([head, "z"] as never).evaluate();
    expect(r.operator, head).toBe(head);
  }
});

// --- Cross-checks -------------------------------------------------------------------------

test("cross-check: UnitBox(x) = HeavisidePi(x) away from the shared boundary", () => {
  for (const x of [0, ["Rational", 1, 3], -0.2, 2]) {
    const a = ce.box(["UnitBox", x] as never).evaluate();
    const b = ce.box(["HeavisidePi", x] as never).evaluate();
    expect(a.isSame(b), JSON.stringify(x)).toBe(true);
  }
});

test("cross-check: Ramp(x) = x * UnitStep(x)", () => {
  for (const x of [-3, 0, 4, ["Rational", 1, 2]]) {
    const ramp = ce.box(["Ramp", x] as never).evaluate();
    const viaStep = ce.box(["Multiply", x, ["UnitStep", x]] as never).evaluate();
    expect(ramp.isSame(viaStep), JSON.stringify(x)).toBe(true);
  }
});

test("cross-check: SawtoothWave, TriangleWave, SquareWave all have period 1", () => {
  for (const head of ["SawtoothWave", "TriangleWave", "SquareWave"]) {
    for (const x of [0, ["Rational", 1, 4], ["Rational", 3, 4], ["Rational", -3, 10]]) {
      const shifted = ce.function("Add", [ce.box(x as never), ce.number(7)]);
      const a = ce.box([head, x] as never).evaluate();
      const b = ce.function(head, [shifted]).evaluate();
      expect(a.isSame(b), `${head}(${JSON.stringify(x)})`).toBe(true);
    }
  }
});

test("cross-check: Rescale is its own inverse between {min,max} and {0,1}", () => {
  const lo = ce.number(2);
  const hi = ce.number(12);
  for (const x of [2, 5, 12, ["Rational", 15, 2]]) {
    const t = ce.box(["Rescale", x, ["List", lo, hi]] as never).evaluate();
    const back = ce.box(["Rescale", t.json, ["List", 0, 1], ["List", lo.json, hi.json]] as never).evaluate();
    const original = ce.box(x as never).evaluate();
    expect(back.isSame(original), JSON.stringify(x)).toBe(true);
  }
});

test("cross-check: Clip (compute-engine's Clamp) is idempotent", () => {
  const once = ce.box(["Clamp", 5, 0, 3] as never).evaluate();
  const twice = ce.box(["Clamp", once.json, 0, 3] as never).evaluate();
  expect(twice.isSame(once)).toBe(true);
});

test("DiscreteShift: two-step shift equals shifting twice", () => {
  const twoStep = ce.box(["DiscreteShift", ["a", "n"], "n", 2] as never).evaluate();
  const twice = ce.box(["DiscreteShift", ["DiscreteShift", ["a", "n"], "n"], "n"] as never).evaluate();
  expect(twoStep.isSame(twice)).toBe(true);
});

test("D(HeavisideTheta(x)) = DiracDelta(x)", () => {
  const d = ce.box(["D", ["HeavisideTheta", "x"], "x"] as never).evaluate();
  expect(d.json).toEqual(["DiracDelta", "x"]);
});

test("D(Ramp(x)) = UnitStep(x)", () => {
  const d = ce.box(["D", ["Ramp", "x"], "x"] as never).evaluate();
  expect(d.json).toEqual(["UnitStep", "x"]);
});

test("D(UnitBox(x)) is DiracDelta(x + 1/2) - DiracDelta(x - 1/2)", () => {
  const d = ce.box(["D", ["UnitBox", "x"], "x"] as never).evaluate();
  const expected = ce
    .box([
      "Subtract",
      ["DiracDelta", ["Add", "x", ["Rational", 1, 2]]],
      ["DiracDelta", ["Subtract", "x", ["Rational", 1, 2]]],
    ] as never)
    .evaluate();
  expect((d as BoxedExpression).isSame(expected)).toBe(true);
});
