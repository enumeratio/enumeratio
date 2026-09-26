import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

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
