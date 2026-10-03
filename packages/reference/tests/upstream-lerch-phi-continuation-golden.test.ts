import { readFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { type Cx, applyAllPatches, cx, lerchContinued } from "@enumeratio/ce-patches";

// The full oracle comparison for LerchPhi past |z| = 1, via the Hermite-type integral in
// numerics/lerch-phi-continuation.ts -- mpmath.lerchphi at 30 digits
// (golden/upstream/lerch-continuation.golden.json), checked against the internal
// `lerchContinued` kernel directly. A curated handful of these points (plus the branch-cut
// and closed-form checks) lives beside the code, in
// packages/ce-patches/tests/lerch-phi-continuation.test.ts.
//
// Several rows are marked `declines: true` -- their x = -log(z)·(shifted a) sits where
// compute-engine's Gamma(s, x) has lost too many digits to trust (Re(x) < 0, |x| > 2.5).
// mpmath's value is kept on the row for provenance; the assertion is that we decline, not
// that we match it.

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
  /** Past the Gamma(s, x) decline guard (Re(x) < 0, |x| > 2.5): `mpmath` is kept for
   * provenance, but `lerchContinued` must decline rather than trust that region. */
  declines?: boolean;
}

const GOLDEN: readonly Golden[] = JSON.parse(
  readFileSync(new URL("../golden/upstream/lerch-continuation.golden.json", import.meta.url), "utf8"),
);

for (const { label, z, s, a, mpmath, declines } of GOLDEN) {
  test(`lerchContinued: ${label}`, () => {
    const out = lerchContinued(cx(...z), cx(...s), cx(...a), upperGamma);
    if (declines) {
      expect(out).toBeUndefined();
      return;
    }
    expect(out).not.toBeUndefined();
    expect(out!.re).toBeCloseTo(mpmath[0], 9);
    expect(out!.im).toBeCloseTo(mpmath[1], 9);
  });
}
