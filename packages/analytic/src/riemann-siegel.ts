import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { type EvalOptions, isRealInt, wantsNumber } from "./box.ts";
import { logGamma } from "./loggamma.ts";
import { zetaGeneralized } from "./hurwitz-zeta.ts";

// RiemannSiegelTheta(t), RiemannSiegelZ(t), and RiemannZetaZero(k) — reusing the
// existing log-gamma continuation (loggamma.ts) and generalized zeta kernel
// (hurwitz-zeta.ts) rather than re-deriving either. compute-engine has none of these
// three heads (checked with `ce.lookupDefinition` first).
//
// ϑ(t) = Im ln Γ(¼ + it/2) − (t/2) ln π          (RiemannSiegelTheta)
// Z(t)  = e^{iϑ(t)} ζ(½ + it)                     (RiemannSiegelZ, real for real t)
// Both real-t only here — Wolfram extends both off the real line, but the backlog
// only asks for real t, and neither is needed complex to reach RiemannZetaZero.
//
// ζ(½ + it) is HurwitzZeta/Zeta's own generalized kernel at a = 1, which reduces to
// the Riemann zeta; every value here is already covered by hurwitz-zeta.ts's own
// Euler–Maclaurin tests, so this file adds no new zeta evaluation of its own.

/** ϑ(t) for real t. */
function theta(t: number): number {
  const lg = logGamma({ re: 0.25, im: t / 2 });
  return lg.im - (t / 2) * Math.log(Math.PI);
}

/** Z(t) for real t: real by construction (the imaginary part cancels to rounding noise). */
function riemannSiegelZ(t: number): number {
  const th = theta(t);
  const z = zetaGeneralized({ re: 0.5, im: t }, { re: 1, im: 0 });
  return Math.cos(th) * z.re - Math.sin(th) * z.im;
}

// --- RiemannZetaZero -----------------------------------------------------------------
//
// t_k is located by a plain sign-change scan of Z along the real line from t ≈ 0,
// counting zero crossings as it goes, and bisecting the bracket once the k-th crossing
// is found. This needs no Gram-point bookkeeping and so isn't exposed to a Gram's-law
// failure (the rare case where consecutive Gram points don't bracket exactly one zero
// each) — it just counts sign changes, wherever they fall.
//
// The step is adaptive: a fraction of the mean local zero spacing 2π/ln(t/2π), which
// shrinks as t grows (zeros crowd closer together), floored so it never vanishes for
// small t. That keeps the scan from skipping a crossing anywhere in range.
//
// Supported range: k such that t_k ≤ MAX_T. MAX_T = 2000 reaches roughly the first
// 1400 zeros (way past the k ≤ 10 the backlog tests) while keeping the scan itself
// well under a second. Above that this file declines rather than guess — a linear
// scan out that far is not worth the wait, and isn't validated against Gram's law
// exceptions (the first is at Gram index 126) or missed close pairs.
const MAX_T = 2000;

function meanSpacing(t: number): number {
  const x = Math.max(t, 10) / (2 * Math.PI);
  return (2 * Math.PI) / Math.log(x + 2);
}

/** t_k, or undefined if it isn't found by t = MAX_T. */
function riemannZetaZeroT(k: number): number | undefined {
  let t = 0.5;
  let prev = riemannSiegelZ(t);
  let count = 0;
  while (t < MAX_T) {
    const step = Math.max(0.02, Math.min(0.5, meanSpacing(t) / 10));
    const next = t + step;
    const cur = riemannSiegelZ(next);
    if ((prev < 0 && cur > 0) || (prev > 0 && cur < 0)) {
      count++;
      if (count === k) {
        let lo = t;
        let hi = next;
        let flo = prev;
        for (let i = 0; i < 80; i++) {
          const mid = (lo + hi) / 2;
          const fm = riemannSiegelZ(mid);
          if ((flo < 0 && fm < 0) || (flo > 0 && fm > 0)) {
            lo = mid;
            flo = fm;
          } else {
            hi = mid;
          }
        }
        return (lo + hi) / 2;
      }
    }
    t = next;
    prev = cur;
  }
  return undefined;
}

export function declareRiemannSiegel(ce: ComputeEngine): void {
  ce.declare("RiemannSiegelTheta", {
    signature: "(number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const t = ops[0];
      if (t === undefined || t.im !== 0 || !Number.isFinite(t.re)) return undefined;
      if (t.re === 0) return ce.Zero; // ϑ(0) = Im ln Γ(¼) = 0 exactly — no N() needed
      if (!wantsNumber(ops, options)) return undefined;
      return ce.number(theta(t.re));
    },
  });

  ce.declare("RiemannSiegelZ", {
    signature: "(number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const t = ops[0];
      if (t === undefined || t.im !== 0 || !Number.isFinite(t.re)) return undefined;
      if (!wantsNumber(ops, options)) return undefined;
      return ce.number(riemannSiegelZ(t.re));
    },
  });

  ce.declare("RiemannZetaZero", {
    signature: "(integer) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const k = ops[0];
      if (k === undefined || !isRealInt(k) || k.re < 1) return undefined;
      if (!wantsNumber(ops, options)) return undefined;
      const t = riemannZetaZeroT(k.re);
      if (t === undefined) return undefined; // beyond MAX_T; decline rather than guess
      return ce.number(ce.complex(0.5, t));
    },
  });
}
