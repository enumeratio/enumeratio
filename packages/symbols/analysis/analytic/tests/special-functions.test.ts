import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// GammaRegularized's generalized (three-argument) incomplete-gamma extension has no mapped
// oracle binding (see GammaRegularized.yaml). Oracle coverage (mpmath's gammainc and a
// Wolfram kernel) now lives as `known` values on the reference examples
// (packages/reference/tests/known.test.ts), not here.

const ce = new ComputeEngine();
declareAnalytic(ce);

type Expr = number | string | readonly [string, ...Expr[]];

const exactJson = (input: Expr, expected: unknown) => expect(ce.box(input).evaluate().json).toEqual(expected);
const num = (input: Expr): number => ce.box(input).N().re;

// --- Catalan -------------------------------------------------------------------------

test("Catalan is a held numeric constant, like EulerGamma", () => {
  exactJson("Catalan", "Catalan");
  expect(num("Catalan")).toBeCloseTo(0.915965594177219, 15);
});
