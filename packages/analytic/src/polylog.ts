import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import {
  type BoxInput,
  declined,
  type EvalOptions,
  isFiniteNum,
  type NativeEval,
  numberResult,
  wantsNumber,
} from "./box.ts";
import { type Cx, mul } from "./complex.ts";
import { lerchContinued } from "./lerch-continuation.ts";
import { lerchPhi } from "./lerch.ts";

// Polylogarithm Liₛ(z) = Σ_{n≥1} zⁿ/nˢ, as the Lerch transcendent at a = 1:
// Liₛ(z) = z·Φ(z, s, 1). compute-engine has a native PolyLog(s, z), but it evaluates
// only at integer order s; this fills in the non-integer and complex orders from the
// Lerch series, which covers |z| ≤ 1 (the |z| = 1 rim included, via the Euler
// transform in lerch.ts). Past the disk (and on the rim once Re(s) ≤ 1, where the
// series does not converge) it goes through the same Hermite-integral continuation
// LerchPhi uses (lerch-continuation.ts), so e.g. PolyLog(2.5, 2) evaluates rather
// than staying symbolic.
//
// Accuracy note: only real z < 0 gets the Euler transform, so |z| = 1 elsewhere on
// the rim (Li₂(i), say) is direct-summed and lands near 1e-11 rather than 1e-15.

/** Liₛ(z) = z·Φ(z, s, 1) for complex s, z. NaN outside |z| ≤ 1 (no continuation). */
export const polyLog = (s: Cx, z: Cx): Cx => mul(z, lerchPhi(z, s, { re: 1, im: 0 }));

/** Real-valued Liₛ(z) for real s, z — the real-scalar shape the compiled
 * (JS/GPU) plotting pipeline consumes. */
export const polyLogReal = (s: number, z: number): number =>
  polyLog({ re: s, im: 0 }, { re: z, im: 0 }).re;

/**
 * Evaluate PolyLog(s, z), deferring to compute-engine's native handler first and
 * only stepping in where it declines. Exact reduction added on the way through:
 * Liₛ(1) = ζ(s), which the native handler only knows for integer s.
 */
export function evaluatePolyLog(
  ce: ComputeEngine,
  native: NativeEval,
  ops: readonly BoxedExpression[],
  options: EvalOptions,
): BoxedExpression | undefined {
  const r = native?.(ops, options);
  if (!declined(r, "PolyLog")) return r;

  const s = ops[0];
  const z = ops[1];
  if (s === undefined || z === undefined) return r;
  const numeric = wantsNumber(ops, options);

  // Liₛ(1) = ζ(s) — exact, and valid for the non-integer s the native handler skips.
  if (z.im === 0 && z.re === 1) {
    const zeta = ce.box(["Zeta", s.json as unknown as BoxInput] as unknown as BoxInput);
    return numeric ? zeta.N() : zeta.evaluate();
  }

  if (numeric && isFiniteNum(s) && isFiniteNum(z)) {
    const absZ = Math.hypot(z.re, z.im);
    const onRim = z.im !== 0 && Math.abs(absZ - 1) < 1e-9 && s.re <= 1;
    // Past |z| = 1 (the rim included, once the series there wouldn't converge): the same
    // integral continuation LerchPhi uses, scaled by z — Liₛ(z) = z·Φ(z, s, 1).
    if (absZ > 1 || onRim) {
      const upperGamma = (sigma: Cx, x: Cx): Cx | undefined => {
        const v = ce.box(["Gamma", ["Complex", sigma.re, sigma.im], ["Complex", x.re, x.im]]).N();
        return isFiniteNum(v) ? { re: v.re, im: v.im } : undefined;
      };
      const phi = lerchContinued(
        { re: z.re, im: z.im },
        { re: s.re, im: s.im },
        { re: 1, im: 0 },
        upperGamma,
      );
      return phi === undefined ? r : numberResult(ce, mul({ re: z.re, im: z.im }, phi));
    }
    // Inside its disk of convergence, the Lerch series directly.
    return numberResult(ce, polyLog({ re: s.re, im: s.im }, { re: z.re, im: z.im }));
  }

  return r; // keep whatever symbolic form the native handler produced
}
