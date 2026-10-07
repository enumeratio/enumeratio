import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// Arccot's special-value table follows compute-engine's own (0, pi) range: exact
// evaluate() and N() must agree at every table point.

const ce = new ComputeEngine();
declareAnalytic(ce);

test("Arccot's exact table and N() agree at every point", () => {
  for (const x of [1, 0, ["Sqrt", 3], -1, ["Negate", ["Sqrt", 3]]] as const) {
    const exact = ce.box(["Arccot", x] as never).evaluate();
    const numeric = ce.box(["N", ["Arccot", x]] as never).evaluate();
    expect(exact.N().re, JSON.stringify(x)).toBeCloseTo(numeric.re, 9);
  }
});

const imaginary = (multiple: number) => ["Multiply", ["Complex", 0, multiple], "Pi"] as const;

test("Coth and Csch at i*k*pi are poles, and only there", () => {
  for (const head of ["Coth", "Csch"]) {
    for (const k of [1, 2, -3]) {
      expect(ce.box([head, imaginary(k)] as never).evaluate().json, `${head} ${k}`).toBe("ComplexInfinity");
    }
    expect(ce.box([head, ["Multiply", ["Complex", 0, 1], "x"]] as never).evaluate().operator).toBe(head);
    expect(ce.box([head, ["Divide", imaginary(1), 2]] as never).evaluate().operator).toBe(head);
  }
});

test("Series of Coth and Csch at 2*pi*i is the Laurent series, not a Taylor one with infinite coefficients", () => {
  const point = ["Add", imaginary(2), 0.05];
  for (const head of ["Coth", "Csch"]) {
    const series = ce.box(["Normal", ["Series", [head, "x"], "x", imaginary(2), 3]] as never).evaluate();
    const near = series.subs({ x: ce.box(point as never) }).N();
    const direct = ce.box([head, point] as never).N();
    expect(near.re, head).toBeCloseTo(direct.re, 6);
    expect(near.im, head).toBeCloseTo(direct.im, 6);
  }
});
