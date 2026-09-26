import type { BigDecimal, BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigIntegerAt, bigRationalAt, wrapOperator } from "@enumeratio/boxed";
import { isFiniteNum } from "./box.ts";
import { cx } from "./complex.ts";
import { logGamma } from "./loggamma.ts";
import { DOUBLE_DIGITS } from "./precise.ts";

/**
 * Box a JS double as a float, not an exact bignum integer. `ce.number(x)` for a huge,
 * integer-VALUED double — which every double past 2^53 is, having no fractional bits
 * left to hold — prints as a full decimal expansion of that double's exact binary value
 * (`ce.number(6.897755278982137e302).toString()` gives a 303-digit integer, not
 * `6.897755278982137e+302`) whenever `ce.precision` is at or below `DOUBLE_DIGITS`:
 * compute-engine represents a number as either a machine double or a bignum depending on
 * `ce.precision` (`bignumPreferred`), and only the bignum representation's printer treats
 * an "exact-looking" huge integer sensibly, rounding it to the requested precision instead
 * of expanding it. `.json` and `.latex` are unaffected either way — this is purely a
 * `.toString()` ceiling on the machine-double path — but constructing the number while
 * `ce.precision` is nudged one digit above `DOUBLE_DIGITS`, then restoring it, forces the
 * bignum path for just this literal without touching the caller's precision setting.
 */
function floatNumber(ce: ComputeEngine, x: number): BoxedExpression {
  const saved = ce.precision;
  if (saved <= DOUBLE_DIGITS) ce.precision = DOUBLE_DIGITS + 1;
  try {
    return ce.number(x.toString());
  } finally {
    ce.precision = saved;
  }
}

/**
 * As `floatNumber`, but for a complex result. The same nudge-and-restore around building
 * the `Complex` node reliably fixes `.re`/`.im`/`.json`/`.latex` (all already correct here
 * regardless), but NOT `.toString()`: compute-engine canonicalizes `Complex(re, im)` into
 * its own machine-pair value, which — unlike a plain real Number literal — doesn't
 * consult `bignumPreferred`/`ce.precision` when deciding whether to print an
 * integer-valued component in full; that particular expansion is a compute-engine
 * limitation in its Complex formatter, not something reachable from here. Still worth
 * doing: it's no worse than the plain construction, and it's what keeps the real branch
 * (`floatNumber`) correct.
 */
function floatComplex(ce: ComputeEngine, re: number, im: number): BoxedExpression {
  const saved = ce.precision;
  if (saved <= DOUBLE_DIGITS) ce.precision = DOUBLE_DIGITS + 1;
  try {
    return ce.box(["Complex", { num: re.toString() }, { num: im.toString() }]).evaluate();
  } finally {
    ce.precision = saved;
  }
}

// #113 "wrong answers today": three heads whose existing numeric kernel gives a
// finite, correct answer in general but a specific wrong one at the argument
// this lane's items name — each fixed as a pre-check ahead of the kernel that
// already gets the general case right, same pattern as threading-113.ts and
// closed-forms-113.ts.

/**
 * LogGamma at a huge real argument: `evaluateLogGamma` (special-functions.ts) routes a
 * positive real z through either compute-engine's own `GammaLn` (z > 0, for its bignum
 * precision) or `Ln(Factorial(z-1))` (an exact integer z) — both of which compute Γ (or
 * n!) itself before taking the log, so they overflow to +Infinity long before ln Γ does:
 * Γ(10^300) is far past a double's range even though ln Γ(10^300) ≈ 6.898×10²ᵒ² is an
 * ordinary finite double. This package's own `logGamma` (loggamma.ts) never forms Γ — it
 * sums Stirling's series in log-space directly — so it has no such ceiling. Detected
 * after the fact (native produced a non-finite part at a z that isn't actually a pole)
 * rather than by an argument-size threshold, since the two buggy paths kick in at
 * different sizes and either one can be the culprit.
 */
function declarePreciseLogGamma(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["LogGamma", 1],
    (ops) => ops[0] !== undefined,
    (native) => (ops, options) => {
      const z = ops[0];
      const r = native?.(ops, options);
      if (!options.numericApproximation || r === undefined || !isFiniteNum(z)) return r;
      const isPole = z.im === 0 && z.re <= 0 && Number.isInteger(z.re);
      if (isPole) return r; // a genuine pole of Gamma — +Infinity is the right answer
      const overflowed = !Number.isFinite(r.re) || !Number.isFinite(r.im);
      if (!overflowed) return r;
      const g = logGamma(cx(z.re, z.im));
      if (!Number.isFinite(g.re) || !Number.isFinite(g.im)) return r; // genuinely non-finite
      if (g.im === 0) return floatNumber(ce, g.re);
      return floatComplex(ce, g.re, g.im);
    },
    1,
  );
}

/**
 * HarmonicNumber(z, 1): the two-argument form's own continuation, ζ(1) − ζ(1, z+1)
 * (harmonic.ts), hits the ζ(1) pole at EVERY z, since order r = 1 is exactly where the
 * generalizing zeta itself diverges — even though H_z^{(1)} is just H_z, the perfectly
 * finite one-argument harmonic number (ψ(z+1) + γ), and Wolfram's HarmonicNumber[z, 1]
 * agrees with HarmonicNumber[z] for every z. Route order 1 to the one-argument form
 * directly, before the ζ(1) − ζ(1, z+1) continuation ever runs.
 */
function declarePreciseHarmonicNumber(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["HarmonicNumber", 2],
    (ops) => bigIntegerAt(ops[1]) === 1n,
    () => (ops, options) => {
      const oneArg = ce.function("HarmonicNumber", [ops[0]]);
      return options.numericApproximation ? oneArg.N() : oneArg.evaluate();
    },
    2,
  );
}

/** An exact rational `n/d` (d > 0), for the interval search below. */
type Fraction = readonly [n: bigint, d: bigint];

/** `x` exactly: a decimal is `significand · 10^exponent`, so it is already a rational. */
function decimalFraction(x: BigDecimal): Fraction {
  return x.exponent >= 0
    ? [x.significand * 10n ** BigInt(x.exponent), 1n]
    : [x.significand, 10n ** BigInt(-x.exponent)];
}

/** ⌊n/d⌋ for d > 0 (BigInt division truncates toward zero). */
function floorDiv([n, d]: Fraction): bigint {
  const q = n / d;
  return n < 0n && q * d !== n ? q - 1n : q;
}

/**
 * The simplest [[p, q]] (smallest q) with p/q in [lo, hi], 0 < lo ≤ hi — the Stern–Brocot
 * / continued-fraction search for the simplest rational in an interval, which is what
 * Wolfram's `Rationalize[x, dx]` actually finds (the rational with the smallest
 * denominator within dx of x), rather than the nearest continued-fraction convergent of x
 * itself that compute-engine's native `Rationalize` returns. `Rationalize(Pi, 0.001)`
 * is the difference: convergent gives 333/106 (closer to π, but with the larger
 * denominator); this gives Wolfram's 201/64 (the smallest denominator that still lands
 * in [π − 0.001, π + 0.001]).
 *
 * Exact arithmetic, not doubles: each step takes the reciprocal of a fractional part, and
 * a rational's continued fraction ends, so the recursion always bottoms out. In doubles a
 * tolerance below x's ulp collapsed the interval to a point, the fractional part rounded
 * to 0, and `1/0` sent it round forever (`Rationalize(Pi, 1e-16)` overflowed the stack).
 */
function simplestInInterval(lo: Fraction, hi: Fraction): Fraction {
  const fl = floorDiv(lo);
  if (fl * lo[1] === lo[0]) return [fl, 1n]; // lo itself is an integer, and the interval's left edge
  if (fl < floorDiv(hi)) return [fl + 1n, 1n]; // an integer strictly inside (lo, hi]
  // Recurse on the reciprocals of the fractional parts: 1/(hi − fl) ≤ 1/(lo − fl).
  const [p, q] = simplestInInterval([hi[1], hi[0] - fl * hi[1]], [lo[1], lo[0] - fl * lo[1]]);
  return [fl * p + q, p];
}

/** The simplest p/q within `tolerance` of `x`, as a reduced [numerator, denominator]. */
function rationalizeToTolerance([xn, xd]: Fraction, [tn, td]: Fraction): Fraction {
  const lo: Fraction = [xn * td - tn * xd, xd * td];
  const hi: Fraction = [xn * td + tn * xd, xd * td];
  if (lo[0] <= 0n && hi[0] >= 0n) return [0n, 1n]; // 0 is in range and is its own simplest fraction
  if (hi[0] < 0n) {
    const [p, q] = simplestInInterval([-hi[0], hi[1]], [-lo[0], lo[1]]);
    return [-p, q];
  }
  return simplestInInterval(lo, hi);
}

/**
 * `x` as a decimal good to well past `tolerance`, so the interval is x's, not its double's:
 * N(π) is 1.2·10^-16 off π, more than a 10^-16 tolerance. A float literal comes back as
 * written (0.1 stays 1/10), the decimal its author meant.
 */
function decimalBeyond(ce: ComputeEngine, x: BoxedExpression, tolerance: BigDecimal): BigDecimal {
  const precision = ce.precision;
  const whole = Math.max(0, Math.ceil(Math.log10(Math.abs(x.N().re))));
  ce.precision = precision + whole + Math.max(0, -tolerance.exponent);
  try {
    return x.N().bignumRe ?? ce.bignum(x.N().re);
  } finally {
    ce.precision = precision;
  }
}

function declarePreciseRationalize(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["Rationalize", 2],
    (ops) => {
      const x = ops[0];
      const tol = ops[1];
      if (x === undefined || tol === undefined || !isFiniteNum(x) || !isFiniteNum(tol)) {
        return false;
      }
      if (tol.re <= 0) return false; // a non-positive tolerance: leave to native
      return bigRationalAt(x) === undefined; // an already-exact x is returned unchanged
    },
    () => (ops, options) => {
      const tolerance = ops[1].N().bignumRe ?? ce.bignum(ops[1].N().re);
      const x = decimalBeyond(ce, ops[0], tolerance);
      const [p, q] = rationalizeToTolerance(decimalFraction(x), decimalFraction(tolerance));
      const expr = q === 1n ? ce.number(p) : ce.function("Rational", [ce.number(p), ce.number(q)]);
      return options.numericApproximation ? expr.N() : expr.evaluate();
    },
    2,
  );
}

export function declarePrecision113(ce: ComputeEngine): void {
  declarePreciseLogGamma(ce);
  declarePreciseHarmonicNumber(ce);
  declarePreciseRationalize(ce);
}
