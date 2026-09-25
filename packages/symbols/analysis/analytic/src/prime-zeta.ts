import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { type EvalOptions, isFiniteNum, numberResult, wantsNumber } from "./box.ts";
import { add, clog, cx, type Cx, scale } from "./complex.ts";

// PrimeZetaP(s) = Σ_p p^(−s), the sum over primes. Rather than sieving primes and summing
// directly — which converges far too slowly to be useful past a couple of digits — this uses
// the standard Möbius/ζ identity P(s) = Σ_{k≥1} μ(k)/k · ln ζ(ks), valid for Re(s) > 1: each
// ln ζ(ks) → 0 geometrically as k grows (ζ(ks) → 1), so the sum settles in a few dozen terms
// at double precision, reusing this package's own Zeta (which already covers complex s) rather
// than a fresh prime-summation kernel.

const MAX_K = 80;
const TOL = 1e-17;

/** ζ(z) at a (possibly complex) point, via compute-engine's own Zeta — this package's own
 * extended definition once `declareAnalytic` has run, so complex z is already covered. */
function zetaAt(ce: ComputeEngine, z: Cx): Cx {
  const arg = z.im === 0 ? ce.number(z.re) : ce.number(ce.complex(z.re, z.im));
  const r = ce.function("Zeta", [arg]).N();
  return cx(r.re, r.im);
}

function moebiusMu(ce: ComputeEngine, k: number): number {
  return ce.function("MoebiusMu", [ce.number(k)]).evaluate().re;
}

function primeZetaP(ce: ComputeEngine, s: Cx): Cx {
  let sum = cx(0);
  for (let k = 1; k <= MAX_K; k++) {
    const mu = moebiusMu(ce, k);
    if (mu === 0) continue;
    const term = scale(clog(zetaAt(ce, scale(s, k))), mu / k);
    sum = add(sum, term);
    if (k > 5 && Math.hypot(term.re, term.im) < TOL * (1 + Math.hypot(sum.re, sum.im))) break;
  }
  return sum;
}

export function declarePrimeZetaP(ce: ComputeEngine): void {
  ce.declare("PrimeZetaP", {
    signature: "(number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const [s] = ops;
      if (s === undefined || !wantsNumber(ops, options) || !isFiniteNum(s)) return undefined;
      // The Möbius/ζ identity only converges for Re(s) > 1 — decline rather than guess at
      // an analytic continuation past the region it actually proves.
      if (s.re <= 1) return undefined;
      return numberResult(ce, primeZetaP(ce, cx(s.re, s.im)));
    },
  });
}
