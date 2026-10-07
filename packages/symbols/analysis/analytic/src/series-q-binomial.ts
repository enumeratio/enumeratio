import { bigRationalAt, type Engine, type Expr, extendHead, operandsOf, symbolNameOf } from "@enumeratio/engine";
import type { EvalOptions } from "@enumeratio/ce-patches";

// Series of QBinomial(n, k, q) and QFactorial(n, q) at q = 0 for a non-integer rational argument.
// Neither is analytic there (each is a series in q^(1/den)), so compute-engine's Taylor fallback,
// which differentiates at 0, gives Derivative terms that mean nothing.
//
// Wolfram's definitions are infinite-product quotients,
//   QBinomial[n,k,q] = (q^(k+1);q)∞ (q^(n-k+1);q)∞ / ((q;q)∞ (q^(n+1);q)∞),
//   QFactorial[n,q]  = (q;q)∞ / ((q^(n+1);q)∞ (1-q)^n),
// so with q = t^D (D the common denominator of the arguments) every factor is a product of
// (1 − t^m), or a binomial series in t^D: multiply the numerator factors in, divide the denominator
// factors out, all as exact power series in t truncated below `bound`.
//
// The truncation matches Wolfram's SeriesData: order 0 stops at q^(1/D); order o ≥ 1 stops at
// q^(o + min(1, e)) for e the smallest exponent among the factors that stand alone (k+1 and
// n-k+1, or n+1), so an exponent below 1 sets the remainder. Outside the shapes below (n < 0,
// k outside (-1, n+1)) the call is held rather than answered with Derivative terms.

const DEFAULT_ORDER = 5;
/** Longest series, in powers of q^(1/D), this builds; a longer one is held. */
const MAX_TERMS = 3000;

type Rational = readonly [bigint, bigint];

const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b));
const lcm = (a: bigint, b: bigint): bigint => (a * b) / gcd(a, b);
const min = (...xs: bigint[]): bigint => xs.reduce((a, b) => (b < a ? b : a));

/** `x^(numerator/denominator)` in lowest terms: `x`, an integer power, or a rational one. */
function monomial(ce: Engine, x: Expr, numerator: bigint, denominator: bigint): Expr {
  const g = gcd(numerator, denominator);
  const [p, d] = [numerator / g, denominator / g];
  if (d === 1n && p === 1n) return x;
  return ce.function("Power", [x, d === 1n ? ce.number(p) : ce.function("Rational", [ce.number(p), ce.number(d)])]);
}

/**
 * The coefficients of t^0 … t^(bound−1) in ∏(t^a;t^D)∞ over `numerators` divided by the same over
 * `denominators`, each infinite product cut off where its factors pass `bound`.
 */
function productQuotient(
  numerators: readonly bigint[],
  denominators: readonly bigint[],
  unit: bigint,
  bound: number,
): bigint[] {
  const c = new Array<bigint>(bound).fill(0n);
  c[0] = 1n;
  for (const start of numerators) {
    for (let m = start; m < bound; m += unit) {
      for (let i = bound - 1; i >= Number(m); i--) c[i] -= c[i - Number(m)]!;
    }
  }
  for (const start of denominators) {
    for (let m = start; m < bound; m += unit) {
      for (let i = Number(m); i < bound; i++) c[i] += c[i - Number(m)]!;
    }
  }
  return c;
}

/** The series of (1 − t^D)^(−n), as coefficients of t^0 … t^(bound−1): C(n+j−1, j) at t^(jD). */
function binomialSeries(n: Rational, unit: bigint, bound: number): Rational[] {
  const out: Rational[] = new Array<Rational>(bound).fill([0n, 1n]);
  let [num, den] = [1n, 1n];
  for (let j = 0, m = 0; m < bound; j++, m += Number(unit)) {
    out[m] = [num, den];
    // C(n+j, j+1) = C(n+j−1, j) · (n+j) / (j+1)
    num *= n[0] + BigInt(j) * n[1];
    den *= n[1] * BigInt(j + 1);
    const g = gcd(num, den);
    [num, den] = [num / g, den / g];
  }
  return out;
}

/** The product of an integer series with a rational one, truncated to the shorter length. */
function multiplySeries(a: readonly bigint[], b: readonly Rational[]): Rational[] {
  return a.map((_, m) => {
    let [num, den] = [0n, 1n];
    for (let i = 0; i <= m; i++) {
      const [bn, bd] = b[m - i]!;
      if (a[i] === 0n || bn === 0n) continue;
      [num, den] = [num * bd + a[i]! * bn * den, den * bd];
      const g = gcd(num, den) || 1n;
      [num, den] = [num / g, den / g];
    }
    return [num, den] as Rational;
  });
}

export function declareSeriesQBinomial(ce: Engine): void {
  const native = ce.lookupDefinition("Series");
  if (native === undefined || !("operator" in native)) return;
  const before = native.operator.evaluate;
  extendHead(ce, "Series", {
    evaluate: (ops: readonly Expr[], options: EvalOptions) => {
      const [f, x, x0, order] = ops;
      const head = f?.operator;
      if ((head !== "QBinomial" && head !== "QFactorial") || x === undefined || x0 === undefined) {
        return before?.(ops, options);
      }
      if (options.numericApproximation) return before?.(ops, options);
      const isBinomial = head === "QBinomial";
      const args = operandsOf(f);
      const [n, k, q] = [args[0], isBinomial ? args[1] : undefined, args[isBinomial ? 2 : 1]];
      const extra = args.slice(isBinomial ? 3 : 2);
      const variable = symbolNameOf(x);
      const nr = bigRationalAt(n);
      const kr = isBinomial ? bigRationalAt(k) : ([0n, 1n] as const);
      const claimed =
        variable !== undefined &&
        extra.length === 0 &&
        q !== undefined &&
        symbolNameOf(q) === variable &&
        x0.N().re === 0 &&
        nr !== undefined &&
        kr !== undefined;
      if (!claimed) return before?.(ops, options);

      // undefined leaves the Series call as it is.
      const held = (): undefined => undefined;
      const o = order === undefined ? DEFAULT_ORDER : Math.floor(order.N().re);
      if (!(o >= 0) || !Number.isFinite(o)) return before?.(ops, options);

      // The arguments over their common denominator D: every exponent below counts powers of q^(1/D).
      const unit = lcm(nr[1], kr[1]);
      const [N, K] = [(nr[0] * unit) / nr[1], (kr[0] * unit) / kr[1]];
      const [a1, a2, a3] = [K + unit, N - K + unit, N + unit];
      if (isBinomial ? a3 < unit : a3 <= 0n) return held();
      // A numerator factor (q^m;q)∞ with m a non-positive integer contains 1 − q^0 = 0.
      if (isBinomial && ((a1 <= 0n && a1 % unit === 0n) || (a2 <= 0n && a2 % unit === 0n))) return ce.Zero;
      if (a1 <= 0n || a2 <= 0n) return held();

      const bound = o === 0 ? 1n : BigInt(o) * unit + (isBinomial ? min(unit, a1, a2) : min(unit, a3));
      if (bound > BigInt(MAX_TERMS)) return held();

      const integral = isBinomial
        ? productQuotient([a1, a2], [unit, a3], unit, Number(bound))
        : productQuotient([unit], [a3], unit, Number(bound));
      const coefficients: Rational[] = isBinomial
        ? integral.map((c) => [c, 1n] as Rational)
        : multiplySeries(integral, binomialSeries(nr, unit, Number(bound)));
      const terms: Expr[] = [];
      coefficients.forEach(([num, den], m) => {
        if (num === 0n) return;
        const c = den === 1n ? ce.number(num) : ce.function("Rational", [ce.number(num), ce.number(den)]);
        terms.push(m === 0 ? c : ce.function("Multiply", [c, monomial(ce, x, BigInt(m), unit)]));
      });
      terms.push(ce.function("BigO", [monomial(ce, x, bound, unit)]));
      return ce.function("Add", terms);
    },
  });
}
