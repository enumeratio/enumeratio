import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { type EvalOptions, isRealInt, wantsNumber } from "./box.ts";

// DigammaFunctionZero(n) — Fungrim's n-th real zero of the digamma function ψ.
//
// ψ is real, meromorphic, with simple poles at 0, −1, −2, … and strictly increasing
// (ψ' = trigamma > 0 everywhere on the reals) between consecutive poles. That gives
// exactly one zero per interval: n = 0 names the zero on (0, ∞) — the classical
// x₀ ≈ 1.4616321449683623 — and n ≥ 1 names the zero on (−n, −n + 1). Bisection on
// ψ (native, complex-capable but exact and monotone on each real interval) finds it
// without a digamma reimplementation: ψ → −∞ at the interval's right pole and +∞ at
// its left one (n ≥ 1), or the reverse for n = 0's unbounded interval, so a fixed
// number of bisection steps (each halving the bracket) is enough for double precision.

const psi = (ce: ComputeEngine, x: number): number => ce.box(["Digamma", x]).N().re;

/** Bisect ψ to a zero inside (lo, hi), where ψ(lo) and ψ(hi) have opposite signs. */
function bisect(ce: ComputeEngine, lo: number, hi: number): number {
  let a = lo;
  let b = hi;
  let fa = psi(ce, a);
  for (let i = 0; i < 100; i++) {
    const mid = 0.5 * (a + b);
    const fm = psi(ce, mid);
    if (fm === 0 || b - a < 1e-15 * Math.max(1, Math.abs(mid))) return mid;
    if ((fa < 0 && fm < 0) || (fa > 0 && fm > 0)) {
      a = mid;
      fa = fm;
    } else {
      b = mid;
    }
  }
  return 0.5 * (a + b);
}

/** The n-th real zero of ψ, n ≥ 0 an integer (see file header for the indexing). */
export function digammaFunctionZero(ce: ComputeEngine, n: number): number {
  if (n === 0) {
    // ψ(ε) → −∞, ψ(large) → +∞; 1e-6..10 safely brackets the single zero (≈1.4616).
    return bisect(ce, 1e-6, 10);
  }
  const eps = 1e-9;
  // (−n, −n+1): ψ → −∞ at the left pole, +∞ approaching the right one.
  return bisect(ce, -n + eps, -n + 1 - eps);
}

export function declareDigammaFunctionZero(ce: ComputeEngine): void {
  ce.declare("DigammaFunctionZero", {
    signature: "(integer) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const n = ops[0];
      if (n === undefined || !isRealInt(n) || n.re < 0) return undefined;
      if (!wantsNumber(ops, options)) return undefined;
      return ce.number(digammaFunctionZero(ce, n.re));
    },
  });
}
