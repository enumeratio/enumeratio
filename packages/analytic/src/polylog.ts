import { BigDecimal, type BoxedExpression, type ComputeEngine } from "@cortex-js/compute-engine";
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
import { lerchPhi } from "./lerch.ts";
import { lerchPhiBig } from "./lerch-big.ts";
import { bigRealOperand, bigResult } from "./precise.ts";

// Polylogarithm Liₛ(z) = Σ_{n≥1} zⁿ/nˢ, as the Lerch transcendent at a = 1:
// Liₛ(z) = z·Φ(z, s, 1). compute-engine has a native PolyLog(s, z), but it evaluates
// only at integer order s; this fills in the non-integer and complex orders from the
// Lerch series, which covers |z| ≤ 1 (the |z| = 1 rim included, via the Euler
// transform in lerch.ts). Outside the disk the continuation is left to the native
// handler, so PolyLog(2.5, 2) stays symbolic rather than returning a wrong number.
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
  // Real s and z past a double's digits, ahead of the native handler, which answers integer
  // orders in doubles: Liₛ(z) = z·Φ(z, s, 1) on the arbitrary-precision series (lerch-big.ts).
  if (wantsNumber(ops, options) && ops[0] !== undefined && ops[1] !== undefined) {
    const s = bigRealOperand(ce, ops[0]);
    const z = bigRealOperand(ce, ops[1]);
    const phi = s && z ? lerchPhiBig(z, s, BigDecimal.ONE, ce.precision) : undefined;
    if (phi !== undefined) return bigResult(ce, z!.mul(phi));
  }
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

  // Numeric via the Lerch series, inside its disk of convergence only.
  if (numeric && isFiniteNum(s) && isFiniteNum(z) && Math.hypot(z.re, z.im) <= 1) {
    return numberResult(ce, polyLog({ re: s.re, im: s.im }, { re: z.re, im: z.im }));
  }

  return r; // keep whatever symbolic form the native handler produced
}
