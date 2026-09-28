import { readFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { type Cx, applyAllPatches, cx, lerchContinued } from "@enumeratio/for-compute-engine/src";

// The full oracle comparison for LerchPhi past |z| = 1, via the Hermite-type integral in
// numerics/lerch-phi-continuation.ts -- mpmath.lerchphi at 30 digits
// (golden/upstream/lerch-continuation.golden.json), checked against the internal
// `lerchContinued` kernel directly. A curated handful of these points (plus the branch-cut
// and closed-form checks) lives beside the code, in
// upstream/compute-engine/tests/lerch-phi-continuation.test.ts.

const ce = new ComputeEngine();
applyAllPatches(ce);

/** compute-engine's own upper incomplete Γ, the same bridge hurwitz-zeta.ts uses. */
const upperGamma = (sigma: Cx, x: Cx): Cx | undefined => {
  const v = ce.box(["Gamma", ["Complex", sigma.re, sigma.im], ["Complex", x.re, x.im]]).N();
  return Number.isFinite(v.re) && Number.isFinite(v.im) ? { re: v.re, im: v.im } : undefined;
};

interface Golden {
  label: string;
  z: [number, number];
  s: [number, number];
  a: [number, number];
  mpmath: [number, number];
}

const GOLDEN: readonly Golden[] = JSON.parse(
  readFileSync(new URL("../golden/upstream/lerch-continuation.golden.json", import.meta.url), "utf8"),
);

for (const { label, z, s, a, mpmath } of GOLDEN) {
  test(`lerchContinued: ${label}`, () => {
    const out = lerchContinued(cx(...z), cx(...s), cx(...a), upperGamma);
    expect(out).not.toBeUndefined();
    expect(out!.re).toBeCloseTo(mpmath[0], 9);
    expect(out!.im).toBeCloseTo(mpmath[1], 9);
  });
}
