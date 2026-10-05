import type { BigDecimal, BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import {
  type EvalOptions,
  atDigits,
  bigAdd,
  bigCx,
  bigLog,
  bigRealOperand,
  bigResult,
  exceedsDoublePrecision,
  zetaGeneralizedBig,
  isFiniteNum,
  numberResult,
  wantsNumber,
  add,
  clog,
  cx,
  type Cx,
  scale,
  inexactComplex,
} from "@enumeratio/ce-patches";

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
  const arg = z.im === 0 ? ce.number(z.re) : inexactComplex(ce, z.re, z.im);
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

/**
 * The same identity on the bignum ζ kernel, for real s > 1: each ln ζ(ks) is below 2^(−ks), so
 * K = ⌈digits·log₂10/s⌉ terms clear the digits asked for. Working precision also covers the
 * size of P(s) itself, which is about 2^(−s): a large s has few significant digits left.
 */
function primeZetaPBig(ce: ComputeEngine, s: BigDecimal, digits: number): BigDecimal | undefined {
  const sd = s.toNumber();
  const working = digits + 15 + Math.ceil(sd * Math.log10(2));
  const terms = Math.ceil((working * Math.log2(10)) / sd) + 2;
  return atDigits(working, () => {
    let sum = bigCx(0);
    for (let k = 1; k <= terms; k++) {
      const mu = moebiusMu(ce, k);
      if (mu === 0) continue;
      const zeta = zetaGeneralizedBig(bigCx(s.mul(k)), bigCx(1), working);
      if (zeta === undefined) return undefined;
      const term = bigLog(zeta);
      sum = bigAdd(sum, { re: term.re.mul(mu).div(k), im: term.im.mul(mu).div(k) });
    }
    return sum.re.toPrecision(digits);
  });
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
      // Past a double's digits: the bignum series for real s, else decline rather than pad.
      if (exceedsDoublePrecision(ce, options.numericApproximation)) {
        const big = bigRealOperand(ce, s);
        const value = big === undefined ? undefined : primeZetaPBig(ce, big, ce.precision);
        return value === undefined ? undefined : bigResult(ce, value);
      }
      return numberResult(ce, primeZetaP(ce, cx(s.re, s.im)));
    },
  });
}
