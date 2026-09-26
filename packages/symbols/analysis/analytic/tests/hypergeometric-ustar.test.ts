import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// HypergeometricUStar(a,b,z) = z^a·U(a,b,z) — see hypergeometric-ustar.ts for Kummer's
// connection formula. mpmath's `z**a * hyperu(a,b,z)` values are pinned as examples on
// the head's record.

const ce = new ComputeEngine();
declareAnalytic(ce);

test("declines z = 0 and (near-)integer b", () => {
  expect(ce.box(["HypergeometricUStar", 1, 2, 0]).N().operator).toBe("HypergeometricUStar");
  expect(ce.box(["HypergeometricUStar", 1, 2, 3]).N().operator).toBe("HypergeometricUStar");
});
