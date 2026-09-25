import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareModular } from "../src/declare.ts";

const ce = new ComputeEngine();
declareModular(ce);

type Expr = number | string | readonly [string, ...Expr[]];

test("round trip: ContinuedFraction then FromContinuedFraction recovers the quadratic irrational", () => {
  const cases: Expr[] = [
    ["Sqrt", 2],
    ["Sqrt", 13],
    ["Divide", ["Add", 1, ["Sqrt", 5]], 2],
    ["Divide", ["Add", 3, ["Sqrt", 7]], 2],
    ["Subtract", 1, ["Sqrt", 3]],
  ];
  for (const x of cases) {
    const cf = ce.box(["ContinuedFraction", x]).evaluate();
    const back = ce.box(["FromContinuedFraction", cf]).evaluate();
    // Compare numerically — compute-engine doesn't always hand back the same syntactic
    // shape it was given (e.g. `1 - Sqrt(3)` round-trips to an algebraically equal but
    // differently-written value), so the exact check is on the value, not the JSON.
    expect(back.N().re).toBeCloseTo(ce.box(x).N().re!, 9);
  }
});
