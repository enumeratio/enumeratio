import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigIntegerAt, bigRationalAt, wrapOperator } from "@enumeratio/boxed";
import { isFiniteNum } from "./box.ts";
import { cx } from "./complex.ts";
import { logGamma } from "./loggamma.ts";

/** A wrapper's arity key doesn't filter calls; widened heads reach it with other arities. */
const exactly =
  (n: number, p: (ops: readonly BoxedExpression[]) => boolean) =>
  (ops: readonly BoxedExpression[]): boolean =>
    ops.length === n && p(ops);

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
    exactly(1, (ops) => ops[0] !== undefined),
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
      return g.im === 0 ? ce.number(g.re) : ce.number(ce.complex(g.re, g.im));
    },
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
    exactly(2, (ops) => bigIntegerAt(ops[1]) === 1n),
    () => (ops, options) => {
      const oneArg = ce.function("HarmonicNumber", [ops[0]]);
      return options.numericApproximation ? oneArg.N() : oneArg.evaluate();
    },
  );
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
 */
function simplestInInterval(lo: number, hi: number): [number, number] {
  const fl = Math.floor(lo);
  if (fl === lo) return [fl, 1]; // lo itself is an integer, and the interval's left edge
  const fh = Math.floor(hi);
  if (fl < fh) return [fl + 1, 1]; // an integer strictly inside (lo, hi]
  const [p, q] = simplestInInterval(1 / (hi - fl), 1 / (lo - fl));
  return [fl * p + q, p];
}

/** The simplest p/q within `tolerance` of `x`, as a reduced [numerator, denominator]. */
function rationalizeToTolerance(x: number, tolerance: number): [number, number] {
  const lo = x - tolerance;
  const hi = x + tolerance;
  if (lo <= 0 && hi >= 0) return [0, 1]; // 0 is in range and is its own simplest fraction
  if (hi < 0) {
    const [p, q] = simplestInInterval(-hi, -lo);
    return [-p, q];
  }
  return simplestInInterval(lo, hi);
}

function declarePreciseRationalize(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["Rationalize", 2],
    exactly(2, (ops) => {
      const x = ops[0];
      const tol = ops[1];
      if (x === undefined || tol === undefined || !isFiniteNum(x) || !isFiniteNum(tol)) {
        return false;
      }
      if (tol.re <= 0) return false; // a non-positive tolerance: leave to native
      return bigRationalAt(x) === undefined; // an already-exact x is returned unchanged
    }),
    () => (ops, options) => {
      const [p, q] = rationalizeToTolerance(ops[0].N().re, ops[1].N().re);
      const expr = q === 1 ? ce.number(p) : ce.function("Rational", [p, q]);
      return options.numericApproximation ? expr.N() : expr.evaluate();
    },
  );
}

export function declarePrecision113(ce: ComputeEngine): void {
  declarePreciseLogGamma(ce);
  declarePreciseHarmonicNumber(ce);
  declarePreciseRationalize(ce);
}
