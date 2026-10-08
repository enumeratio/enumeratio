// unstable: a bare engine to declare the analytic library against
import { ComputeEngine } from "@enumeratio/engine/unstable";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// FunctionExpand of ExpIntegralE(n, z) by order, checked against the direct evaluation.

const ce = new ComputeEngine();
declareAnalytic(ce);

const expand = (n: unknown) => ce.box(["FunctionExpand", ["ExpIntegralE", n, "z"]] as never).evaluate();
const half = (num: number) => ["Rational", num, 2];

test("integer orders at or below 0 are elementary", () => {
  expect(expand(0).json).toEqual(["Divide", ["Power", "ExponentialE", ["Negate", "z"]], "z"]);
  expect(JSON.stringify(expand(-4).json)).not.toContain("ExpIntegralE");
  expect(JSON.stringify(expand(-4).json)).not.toContain("Gamma");
});

test("positive integer orders keep E₁, half-integer orders use Erfc, others Gamma", () => {
  expect(JSON.stringify(expand(4).json)).toContain('"ExpIntegralE",1,"z"');
  expect(JSON.stringify(expand(half(5)).json)).toContain("Erfc");
  expect(JSON.stringify(expand(["Rational", 1, 3]).json)).toContain("Gamma");
  expect(expand(1).operator).toBe("ExpIntegralE");
  expect(expand(1.5).operator).toBe("ExpIntegralE");
  expect(expand(100).operator).toBe("ExpIntegralE");
});

test("each rewrite equals the direct value, for real and complex z", () => {
  const orders = [-4, -1, 0, 2, 3, 4, 5, half(1), half(3), half(5), half(7), half(-1), half(-3), ["Rational", 1, 3]];
  for (const n of orders) {
    const expanded = expand(n);
    for (const z of [0.7, 2.5, ["Complex", 1.2, 0.8]]) {
      const label = `n=${JSON.stringify(n)} z=${JSON.stringify(z)}`;
      const got = expanded.subs({ z: ce.box(z as never) }).N();
      const want = ce.box(["ExpIntegralE", n, z] as never).N();
      expect(got.re, label).toBeCloseTo(want.re, 9);
      expect(got.im, label).toBeCloseTo(want.im, 9);
    }
  }
});

test("a list expands element by element", () => {
  const result = ce
    .box(["FunctionExpand", ["List", ["ExpIntegralE", half(5), "z"], ["ExpIntegralE", 0, "z"]]] as never)
    .evaluate();
  expect(result.operator).toBe("List");
  expect(JSON.stringify(result.json)).not.toContain('"ExpIntegralE"');
});
