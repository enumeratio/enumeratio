import { type BigDecimal, type BoxedExpression, type ComputeEngine, isNumber } from "@cortex-js/compute-engine";

/** Above this many digits a double is no longer the limiting factor — and neither should we be. */
export const DOUBLE_DIGITS = 15;

/** `N(expr, d)`'s own Ziv refinement loop calls `evaluate` twice, at `d + 20` then `d + 10`
 * (checked empirically: `N(x, 15)` calls in at precision 35 then 25, `N(x, 50)` at 70 then
 * 60) — and a decline on EITHER pass aborts the whole `N()` symbolic, so the binding
 * constraint is the higher of the two, `d + 20`. A plain `N(expr)` (no explicit digit
 * count) runs once, at the engine's own configured precision, well under that. */
const REQUESTED_DIGITS_GUARD = 20;

/**
 * A kernel with no bignum companion should decline (stay symbolic under `N()`, per
 * "decline rather than answer wrong") once more digits than a double can supply were
 * explicitly asked for — printing a double's ~17 correct digits as if they were the 50
 * requested is silently wrong, not merely imprecise. A plain `N(expr)` at the engine's own
 * default precision (which already exceeds `DOUBLE_DIGITS` on its own) is unaffected: only
 * an explicit `N(expr, d)` with `d > DOUBLE_DIGITS` pushes `ce.precision` past the guard
 * band this checks.
 */
export const exceedsDoublePrecision = (ce: ComputeEngine, numericApproximation: boolean | undefined): boolean =>
  (numericApproximation ?? false) && ce.precision > DOUBLE_DIGITS + REQUESTED_DIGITS_GUARD;

/**
 * Once a periodic double-only kernel's argument spans more than this many periods, `value`'s
 * OWN double rounding (`ulp(value) ~ |value|·2^-52`) already exceeds a period, so the reduced
 * position within it is rounding noise, not signal — no digit count can rescue that. Measured
 * against mpmath at the reported bug (`JacobiCD(10^16, 2/7)`, ~1.5·10^15 periods: wrong even
 * in sign next to a sibling head at the same scale) and at the boundary, holding steady across
 * three unrelated families (a Jacobi pq kernel, `EllipticTheta`, `ModularLambda`, each checked
 * on its own period): at 10^6 periods each still agrees with mpmath to ~9-10 digits; at 10^7,
 * only ~8-9 — already short of the loosest tolerance (1e-9) this family uses anywhere. Kept at
 * a clean order of magnitude below that crossover for margin.
 */
export const MAX_PERIODS_FOR_DOUBLE = 1e6;

/** `value`'s own double rounding has already swallowed more than `maxPeriods` worth of
 * `period` — declining is safer than returning a reduced position that's pure rounding noise.
 * `false` (never decline) for a non-finite or non-positive `period`, e.g. a family's own
 * period computation didn't converge or doesn't apply at this operand. */
export const periodsExceedDouble = (value: number, period: number, maxPeriods = MAX_PERIODS_FOR_DOUBLE): boolean =>
  Number.isFinite(value) && Number.isFinite(period) && period > 0 && Math.abs(value) / period > maxPeriods;

/**
 * Below this many multiples of `1/Im(τ)`, a modular kernel's own SL2(Z) reduction
 * (`reduceToFundamentalDomain`, modular.ts) is climbing toward a genuine cusp asymptotic —
 * the true value there really does grow roughly like `exp(π/Im τ)` (checked against mpmath:
 * `ModularLambda` matches it to ~14-16 digits well past this), not a numerical artifact. But
 * that same growth costs a double kernel digits just as fast once τ is close enough to the
 * real axis: measured against mpmath, `1/Im τ = 100` still agrees to ~12 digits, `1/Im τ = 150`
 * only ~10, and `1/Im τ = 200` just ~7 — already short of this family's loosest tolerance
 * (1e-9) — with the double kernel overflowing outright by `1/Im τ ≈ 400`.
 */
export const MAX_INVERSE_IM_TAU = 100;

/** `τ` is close enough to the real axis that its true (correct) growth there already costs a
 * double kernel more digits than `MAX_INVERSE_IM_TAU`'s measured margin allows. */
export const tauTooCloseToRealAxis = (im: number): boolean =>
  Number.isFinite(im) && Math.abs(im) < 1 / MAX_INVERSE_IM_TAU;

/**
 * `value` rounded to the digits the engine was actually asked for, or undefined if it is not
 * a number at all.
 *
 * compute-engine lets a bignum product carry more digits than its operands had — real for
 * `Sin(1)·Cos(1)`, and worse for anything we assemble out of natives, where the tail is the
 * truncation error rather than merely unwarranted. A head should hand back the precision it
 * claims and no more, so every routed result goes through here.
 */
export function atEnginePrecision(ce: ComputeEngine, value: BoxedExpression): BoxedExpression | undefined {
  if (!isNumber(value)) return undefined;
  const big = value.bignumRe;
  return big === undefined ? value : ce.number(big.toPrecision(ce.precision));
}

/**
 * `compute()` run with `guard` extra digits of working precision, its result rounded back
 * to the caller's — for a formula whose own arithmetic loses the last few.
 */
export function withGuardDigits(ce: ComputeEngine, compute: () => BoxedExpression, guard = 10): BoxedExpression {
  const precision = ce.precision;
  ce.precision = precision + guard;
  let value: BoxedExpression;
  try {
    value = compute();
  } finally {
    ce.precision = precision;
  }
  return atEnginePrecision(ce, value) ?? value;
}

/**
 * A real operand as a decimal to the engine's precision, for an arbitrary-precision kernel --
 * or undefined when the engine asks for no more than a double (the double kernel is then the
 * better trade) or `x` is not a finite real number.
 */
export function bigRealOperand(ce: ComputeEngine, x: BoxedExpression): BigDecimal | undefined {
  if (ce.precision <= DOUBLE_DIGITS || x.im !== 0 || !Number.isFinite(x.re)) return undefined;
  return x.bignumRe ?? ce.bignum(x.re);
}

/** An arbitrary-precision kernel's value, boxed at the engine's precision. */
export const bigResult = (ce: ComputeEngine, value: BigDecimal): BoxedExpression =>
  ce.number(value.toPrecision(ce.precision));

/**
 * Does `ce` evaluate `expr` numerically to more than a double's digits? Asked at precision
 * 30, restoring the engine's own precision after: a patch's `fixed` runs on the live engine.
 */
export function answersPastDouble(ce: ComputeEngine, expr: unknown): boolean {
  const saved = ce.precision;
  try {
    ce.precision = 30;
    const json = ce.box(expr as never).N().json as unknown;
    const text = typeof json === "object" && json !== null && "num" in json ? String(json.num) : "";
    return text.replace(/^-?0*\.?0*/, "").replace(/\D/g, "").length > DOUBLE_DIGITS + 2;
  } finally {
    ce.precision = saved;
  }
}
