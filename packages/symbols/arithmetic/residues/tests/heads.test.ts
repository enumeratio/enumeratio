import { ComputeEngine } from "@cortex-js/compute-engine";
import { bigIntegerAt, operandsOf } from "@enumeratio/boxed";
import { expect, test } from "vite-plus/test";
import { declareResidues } from "../src/declare.ts";

const ce = new ComputeEngine();
declareResidues(ce);

test("PowerModList reaches moduli no scan could", () => {
  const cubeRoots = operandsOf(
    ce.box(["PowerModList", 2, ["Divide", 1, 3], ["Subtract", ["Power", 2, 89], 1]]).evaluate(),
  ).map(bigIntegerAt);
  expect(cubeRoots).toHaveLength(3);
  const p = 2n ** 89n - 1n;
  for (const root of cubeRoots) expect(root! ** 3n % p).toBe(2n);
});

test("Mod of a bare symbolic constant reduces exactly (#113)", () => {
  // Cross-check numerically: the exact symbolic result and a double both land in [0, 2).
  const exact = ce
    .box(["Mod", "Pi", 2] as never)
    .evaluate()
    .N().re;
  expect(exact).toBeCloseTo(Math.PI - 2, 10);
  expect(exact).toBeGreaterThanOrEqual(0);
  expect(exact).toBeLessThan(2);
});

test("IntegerModRing is ℤ/m as a finite collection", () => {
  expect(ce.parse("\\mathbb{Z}/6\\mathbb{Z}").evaluate().json).toEqual(["IntegerModRing", 6]);
});
