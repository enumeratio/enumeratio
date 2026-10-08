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
// factors out, all as exact power series in t. A factor with m < 0 is −t^m (1 − t^−m): it moves a
// monomial to the front (a negative power of q from a numerator, a positive one from a denominator)
// and leaves a power-series factor.
//
// The truncation matches Wolfram's SeriesData. With every exponent positive, order 0 stops at
// q^(1/D) and order o ≥ 1 at q^(o + min(1, e)) for e the smallest exponent among the factors that
// stand alone (k+1 and n-k+1, or n+1), so an exponent below 1 sets the remainder. With leading
// monomial q^L, a negative numerator exponent stops at q^(L + max(o, 1)), and a QFactorial whose
// n+1 lies in (-1, 0) at q^(L + o). A numerator factor (q^m;q)∞ with m a non-positive integer
// contains 1 − q^0 = 0. Anything else outside these shapes is held rather than answered with
// Derivative terms.

const DEFAULT_ORDER = 5;
/** Longest series, in powers of q^(1/D), this builds; a longer one is held. */
const MAX_TERMS = 3000;

type Rational = readonly [bigint, bigint];

const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b));
const lcm = (a: bigint, b: bigint): bigint => (a * b) / gcd(a, b);
const min = (...xs: bigint[]): bigint => xs.reduce((a, b) => (b < a ? b : a));
const max = (a: bigint, b: bigint): bigint => (a > b ? a : b);

/** `x^(numerator/denominator)` in lowest terms: `x`, `1` for a zero exponent, an integer power, or a rational one. */
function monomial(ce: Engine, x: Expr, numerator: bigint, denominator: bigint): Expr {
  if (numerator === 0n) return ce.One;
  const g = gcd(numerator, denominator);
  const [p, d] = [numerator / g, denominator / g];
  if (d === 1n && p === 1n) return x;
  return ce.function("Power", [x, d === 1n ? ce.number(p) : ce.function("Rational", [ce.number(p), ce.number(d)])]);
}

/** The negative members of a, a + unit, a + 2·unit, …: the factors (1 − t^e) with e < 0. */
function negatives(a: bigint, unit: bigint): bigint[] {
  const out: bigint[] = [];
  for (let e = a; e < 0n; e += unit) out.push(e);
  return out;
}

/** The exponents m ≥ 1 below `reach` of the factors (1 − t^m) in (t^a;t^unit)∞, a negative e reflected to −e. */
function factorExponents(a: bigint, unit: bigint, reach: bigint): bigint[] {
  const out: bigint[] = [];
  for (let e = a; e < reach; e += unit) {
    const m = e < 0n ? -e : e;
    if (m < reach) out.push(m);
  }
  return out;
}

/**
 * The coefficients of t^0 … t^(bound−1) in ∏(1 − t^m) over `numerators` divided by the same over
 * `denominators`.
 */
function productQuotient(numerators: readonly bigint[], denominators: readonly bigint[], bound: number): bigint[] {
  const c = new Array<bigint>(bound).fill(0n);
  if (bound > 0) c[0] = 1n;
  for (const m of numerators) {
    for (let i = bound - 1; i >= Number(m); i--) c[i] -= c[i - Number(m)]!;
  }
  for (const m of denominators) {
    for (let i = Number(m); i < bound; i++) c[i] += c[i - Number(m)]!;
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

/** A series in t = q^(1/unit): the nonzero terms at their exponents of t, and the exponent of t its remainder starts at. */
export interface QSeries {
  unit: bigint;
  terms: (readonly [bigint, Rational])[];
  bound: bigint;
}

/**
 * The series of QBinomial(n, k, q) (`k` given) or QFactorial(n, q) at q = 0 to `order`, `"zero"` for an
 * identically vanishing QBinomial, or `undefined` for a shape it holds.
 */
export function qSeries(n: Rational, k: Rational | undefined, order: number): QSeries | "zero" | undefined {
  const isBinomial = k !== undefined;
  // The arguments over their common denominator D: every exponent below counts powers of q^(1/D).
  const unit = isBinomial ? lcm(n[1], k[1]) : n[1];
  const N = (n[0] * unit) / n[1];
  const K = isBinomial ? (k[0] * unit) / k[1] : 0n;
  const [a1, a2, a3] = [K + unit, N - K + unit, N + unit];
  if (a3 <= 0n && a3 % unit === 0n) return undefined; // a pole
  if (isBinomial && ((a1 <= 0n && a1 % unit === 0n) || (a2 <= 0n && a2 % unit === 0n))) return "zero";

  const numeratorStarts = isBinomial ? [a1, a2] : [unit];
  const denominatorStarts = isBinomial ? [unit, a3] : [a3];
  const [numLow, denLow] = [numeratorStarts.flatMap((a) => negatives(a, unit)), negatives(a3, unit)];
  const sum = (xs: readonly bigint[]) => xs.reduce((s, x) => s + x, 0n);
  const lead = sum(numLow) - sum(denLow);
  const o = BigInt(order);

  let relative: bigint;
  if (isBinomial && numLow.length > 0) {
    relative = unit * max(o, 1n);
  } else if (denLow.length === 0) {
    relative = o === 0n ? 1n : o * unit + (isBinomial ? min(unit, a1, a2) : min(unit, a3));
  } else if (!isBinomial && denLow.length === 1) {
    relative = o * unit;
  } else {
    return undefined;
  }
  if (relative > BigInt(MAX_TERMS)) return undefined;
  const bound = Number(relative);

  const numerators = numeratorStarts.flatMap((a) => factorExponents(a, unit, relative));
  const denominators = denominatorStarts.flatMap((a) => factorExponents(a, unit, relative));
  const integral = productQuotient(numerators, denominators, bound);
  const coefficients: Rational[] = isBinomial
    ? integral.map((c) => [c, 1n] as Rational)
    : multiplySeries(integral, binomialSeries(n, unit, bound));
  // Each reflected factor is −t^e (1 − t^−e).
  const sign = (numLow.length + denLow.length) % 2 === 0 ? 1n : -1n;
  const terms: (readonly [bigint, Rational])[] = [];
  coefficients.forEach(([num, den], m) => {
    if (num !== 0n) terms.push([lead + BigInt(m), [sign * num, den]]);
  });
  return { unit, terms, bound: lead + relative };
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
      const kr = isBinomial ? bigRationalAt(k) : undefined;
      const claimed =
        variable !== undefined &&
        extra.length === 0 &&
        q !== undefined &&
        symbolNameOf(q) === variable &&
        x0.N().re === 0 &&
        nr !== undefined &&
        (!isBinomial || kr !== undefined);
      if (!claimed) return before?.(ops, options);

      const o = order === undefined ? DEFAULT_ORDER : Math.floor(order.N().re);
      if (!(o >= 0) || !Number.isFinite(o)) return before?.(ops, options);

      const result = qSeries(nr, kr, o);
      if (result === undefined) return undefined; // leaves the Series call as it is
      if (result === "zero") return ce.Zero;
      const { unit, terms, bound } = result;
      const sum: Expr[] = terms.map(([exponent, [num, den]]) => {
        const c = den === 1n ? ce.number(num) : ce.function("Rational", [ce.number(num), ce.number(den)]);
        return exponent === 0n ? c : ce.function("Multiply", [c, monomial(ce, x, exponent, unit)]);
      });
      sum.push(ce.function("BigO", [monomial(ce, x, bound, unit)]));
      return ce.function("Add", sum);
    },
  });
}
