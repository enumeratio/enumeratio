import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { type BoxInput, type EvalOptions, isFiniteNum, numberResult, realCompile, wantsNumber } from "../shared/box.ts";
import { bigRealOperand, bigResult } from "../shared/precise.ts";
import type { Cx } from "../shared/complex.ts";
import type { Patch } from "../patch.ts";
import { lerchPhi, lerchPhiReal } from "./lerch.ts";
import { lerchContinued } from "./lerch-continuation.ts";
import { lerchPhiBig, lerchPhiBall } from "./lerch-big.ts";

// cortex-js/compute-engine#340: the Lerch transcendent LerchPhi(z, s, a), which generalizes
// both HurwitzZeta (z = 1) and PolyLog (a = 1). Wolfram has it; compute-engine does not.

/**
 * Evaluate the Lerch transcendent LerchPhi(z, s, a) = Σ zⁿ (n+a)^(−s). Exact
 * reductions: z=1 → HurwitzZeta(s, a); s=0 → 1/(1−z). Otherwise numeric via the
 * direct series (see lerch.ts), which covers |z| ≤ 1.
 */
export function evaluateLerch(
  ce: ComputeEngine,
  ops: readonly BoxedExpression[],
  numeric: boolean,
): BoxedExpression | undefined {
  const z = ops[0];
  const s = ops[1];
  const a = ops[2];
  if (z === undefined || s === undefined || a === undefined) return undefined;
  const box = (expr: unknown) => ce.box(expr as unknown as BoxInput);
  const finish = (expr: BoxedExpression) => (numeric ? expr.N() : expr.evaluate());

  // Φ(1, s, a) = ζ(s, a) — flows into the HurwitzZeta closed forms.
  if (z.im === 0 && z.re === 1) {
    return finish(box(["HurwitzZeta", s.json, a.json]));
  }
  // Φ(0, s, a) = a^(−s): only the n = 0 term survives (0⁰ = 1).
  if (z.is(0)) {
    return finish(box(["Power", a.json, ["Negate", s.json]]));
  }
  // Φ(z, 0, a) = 1/(1 − z), independent of a (the geometric series and its continuation).
  if (s.im === 0 && Number.isInteger(s.re) && s.re === 0) {
    return finish(box(["Divide", 1, ["Subtract", 1, z.json]]));
  }
  // Past |z| = 1 the series stops converging: continue by the integral representation
  // (lerch-continuation.ts), with compute-engine's own upper incomplete Γ. Where that can't
  // be trusted to double precision, stay unevaluated rather than guess. On the rim itself
  // (|z| = 1, real z = −1 excepted: the Euler transform in lerchPhi handles that ray at
  // every s) the direct sum below either diverges outright (Re(s) ≤ 1) or converges too
  // slowly for double precision to matter (a term at n = 200,000 is still ~n^(1−Re(s)) —
  // only ~1e-8 at Re(s) = 1.5), so the whole rim routes through the same continuation,
  // which is accurate there to ~1e-14 at every Re(s) tried.
  const absZ = Math.hypot(z.re, z.im);
  const onRim = z.im !== 0 && Math.abs(absZ - 1) < 1e-9;
  if (numeric && isFiniteNum(z) && isFiniteNum(s) && isFiniteNum(a) && (absZ > 1 || onRim)) {
    const upperGamma = (sigma: Cx, x: Cx): Cx | undefined => {
      const v = ce.box(["Gamma", ["Complex", sigma.re, sigma.im], ["Complex", x.re, x.im]]).N();
      return isFiniteNum(v) ? { re: v.re, im: v.im } : undefined;
    };
    const continued = lerchContinued(
      { re: z.re, im: z.im },
      { re: s.re, im: s.im },
      { re: a.re, im: a.im },
      upperGamma,
    );
    return continued === undefined ? undefined : numberResult(ce, continued);
  }
  if (numeric) {
    // Real arguments past a double's digits: the arbitrary-precision series (lerch-big.ts).
    const [zb, sb, ab] = [z, s, a].map((x) => bigRealOperand(ce, x));
    const phi = zb && sb && ab ? lerchPhiBig(zb, sb, ab, ce.precision) : undefined;
    if (phi !== undefined) return bigResult(ce, phi);
  }
  if (numeric && isFiniteNum(z) && isFiniteNum(s) && isFiniteNum(a)) {
    return numberResult(ce, lerchPhi({ re: z.re, im: z.im }, { re: s.re, im: s.im }, { re: a.re, im: a.im }));
  }
  return undefined; // stay symbolic
}

export const lerchPhiPatch: Patch = {
  id: "lerch-phi",
  issue: "https://github.com/cortex-js/compute-engine/issues/340",
  lands: "LerchPhi(z, s, a), the Lerch transcendent",

  fixed: (ce) => {
    if (ce.lookupDefinition("LerchPhi") === undefined) return false;
    const r = ce.box(["LerchPhi", 0.5, 2, 1]).N();
    return Number.isFinite(r.re) && Math.abs(r.re - 0.5822405264650125) < 1e-9;
  },

  apply: (ce) => {
    ce.declare("LerchPhi", {
      signature: "(number, number, number) -> number",
      evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) =>
        evaluateLerch(ce, ops, wantsNumber(ops, options)),
      compile: realCompile(3, { js: "__lp", wgsl: "lerchPhi" }),
    });
  },
};

export { lerchPhi, lerchPhiReal, lerchContinued, lerchPhiBig, lerchPhiBall };
