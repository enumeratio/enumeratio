import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// The ten backlog heads landed in this pass — ExpIntegralE, LambertW (branches other than
// 0/-1), InverseErfc, InverseGammaRegularized, InverseBetaRegularized, BellY, NorlundB,
// PrimeZetaP, HypergeometricPFQ, KleinInvariantJ. Oracle coverage (a Wolfram kernel) now
// lives as `known` values on the reference examples (packages/reference/tests/known.test.ts);
// the exact symbolic identities each head also carries are checked directly in the
// reference examples (packages/reference), not repeated here.

const ce = new ComputeEngine();
declareAnalytic(ce);

test("LambertW(z, 0) and LambertW(z, -1) still go through compute-engine's native handler", () => {
  // Branches this package does not touch — regression guard against the wrapper ever
  // shadowing them.
  expect(ce.box(["LambertW", -0.14, 0]).N().re).toBeCloseTo(-0.165137789266952, 12);
  expect(ce.box(["LambertW", -0.14, -1]).N().re).toBeCloseTo(-3.096330584262541, 10);
});

test("HypergeometricPFQ declines outside the unit disc when p = q + 1", () => {
  expect(ce.box(["HypergeometricPFQ", ["List", 1, 1], ["List", 2], 1.5]).N().operator).toBe("HypergeometricPFQ");
});

test("PrimeZetaP declines at and below the convergence boundary", () => {
  expect(ce.box(["PrimeZetaP", 1]).N().operator).toBe("PrimeZetaP");
  expect(ce.box(["PrimeZetaP", 0.5]).N().operator).toBe("PrimeZetaP");
});

test("InverseGammaRegularized and InverseBetaRegularized decline outside their domain", () => {
  expect(ce.box(["InverseGammaRegularized", -1, 0.5]).N().operator).toBe("InverseGammaRegularized");
  expect(ce.box(["InverseBetaRegularized", 1.5, 2, 3]).N().operator).toBe("InverseBetaRegularized");
});
