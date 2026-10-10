import type { BigDecimal, BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import {
  type EvalOptions,
  isFiniteNum,
  numberResult,
  wantsNumber,
  add,
  cexp,
  cx,
  type Cx,
  div,
  mul,
  scale,
  logGamma,
  bigRealOperand,
  bigResult,
  exceedsDoublePrecision,
} from "@enumeratio/ce-patches";
import { bigRationalAt } from "@enumeratio/engine";
import {
  hypergeometric1F1RegularizedBig,
  hypergeometric2F1RegularizedBig,
  hypergeometric3F2RegularizedBig,
  pfqBig,
  pfqRegularizedBig,
} from "./hypergeometric-big.ts";

// The generalized hypergeometric series pFq(a1,…,ap; b1,…,bq; z) = Σ_{k≥0} ∏(ai)_k / ∏(bj)_k
// · zᵏ/k!, and its regularized cousin pFq(…)/∏Γ(bj) — Fungrim's frontier heads
// `Hypergeometric0F1`, `Hypergeometric0F1Regularized`, `Hypergeometric1F1Regularized`,
// `Hypergeometric2F1Regularized` and `Hypergeometric3F2Regularized` (fungrim:fe6e74 states the
// 2F1 case exactly: Hypergeometric2F1Regularized(a,b,c,z) = Hypergeometric2F1(a,b,c,z)/Γ(c)).
// compute-engine 0.128 declares `Hypergeometric1F1` and `Hypergeometric2F1` themselves (real and
// complex z, including some continuation past |z| = 1 for 2F1 — probed directly), but none of
// the regularized forms, and no 0F1 or 3F2 at all.
//
// Plain series (`pfqSeries`) is used only for `Hypergeometric0F1`, which nothing else supplies.
// The regularized forms are each their own series (`pfqRegularizedSeries`) rather than "native /
// Gamma(b)", because the whole point of "regularized" is to stay finite exactly where Gamma(b)
// itself has a pole (b a non-positive integer) — a naive division would just trade one NaN for
// another. Dividing by Γ(bj) termwise (via `invGamma`, entire) keeps every term finite and lets
// the sum answer at those poles by the standard limiting convention (1/Γ(−n) = 0).
//
// The double series is what `N()` runs; `N(x, d)` past a double's digits takes the BigDecimal one
// (hypergeometric-big.ts) for Hypergeometric0F1Regularized and Hypergeometric1F1Regularized, for
// real z < 1 (Pfaff's transformation brings z < −½ into the unit disc) Hypergeometric2F1Regularized,
// and for real |z| < 1 Hypergeometric3F2Regularized.
//
// Convergence: p ≤ q (0F1, 1F1Regularized) is entire in z, so those never decline on account of
// z. p = q + 1 (2F1Regularized, 3F2Regularized) only converges for |z| < 1; z on or outside the
// unit circle is declined rather than answering with a wrong analytic continuation (Fungrim's own
// 2F1Regularized identities that reach past |z| = 1, e.g. fungrim:90ac58, rewrite to a *different*
// argument first — that is a job for the identity layer, not this evaluator).

const MAX_TERMS = 500;
const TOL = 1e-16;
/** Digits the bignum series carries before rounding to a double: 17 for the double, plus a guard. */
const DOUBLE_GUARD_DIGITS = 25;
/** Consecutive shrinking terms, with a tail bound under `TOL`, before a sum counts as settled. */
const SETTLED_RUN = 3;
/** The double's unit roundoff scale: each term carries a relative rounding error of about this much. */
const EPS = Number.EPSILON;
/**
 * The most rounding error, relative to the sum, that a double series may keep: `peak / |sum| · EPS`
 * past this declines. Alternating series grow before they shrink, so their sums can be noise while
 * `TOL` still sees the last terms shrink: 1F1(1/2; 3/2; −40) has that figure at 0.28, 0F1(; 1; −200)
 * at 4.5e-5. Measured against mpmath 1.3.0 (0F1(; 1), 0F1(; 5/2) at z = −1/2…−200; 1F1 at five (a; b)
 * pairs, z = −1/2…−80), the actual relative error is within 1.5× of the figure wherever it is under
 * 1e-3: 1e-13 answers to about 13 digits (0F1(; 1; −8): figure 8e-14, error 9e-15) and declines past
 * it (1F1(1; 2; −10): 6e-13, error 1.4e-13). The sweep is `hypergeometric-cancellation.test.ts`
 * under `DEEP_TESTS=1`.
 */
const CANCELLATION_TOL = 1e-13;

/** Did the sum lose so many digits to cancellation (largest term `peak` against `|sum|`) that it is noise? */
const cancelled = (peak: number, sum: Cx): boolean => {
  const size = Math.hypot(sum.re, sum.im);
  return !(size > 0) || (peak / size) * EPS > CANCELLATION_TOL;
};

/** Is z a non-positive integer — a pole of Γ, and so a zero of 1/Γ? */
const isNonPositiveInt = (z: Cx): boolean => z.im === 0 && z.re <= 0 && Number.isInteger(z.re);

/** 1/Γ(z), entire (zero at the non-positive integers, rather than the NaN a naive 1/Γ gets there). */
const invGamma = (z: Cx): Cx => (isNonPositiveInt(z) ? cx(0) : cexp(scale(logGamma(z), -1)));

const mag = (z: Cx): number => Math.hypot(z.re, z.im);

/** 1F1(a; a−1; z)/Γ(a−1) = e^z (1 + z/(a−1))/Γ(a−1), as (a)ₖ/(a−1)ₖ = 1 + k/(a−1) (DLMF 13.6). */
const regularizedMinusOne = (a: Cx, z: Cx): Cx => {
  const shift = add(a, cx(-1));
  return mul(cexp(z), mul(add(cx(1), div(z, shift)), invGamma(shift)));
};

/** Is b = a − 1 on the reals, to the float's rounding? */
const isMinusOneShift = (a: Cx, b: Cx): boolean =>
  a.im === 0 &&
  b.im === 0 &&
  !isNonPositiveInt(add(a, cx(-1))) &&
  Math.abs(b.re - a.re + 1) <= EPS * Math.max(1, Math.abs(a.re), Math.abs(b.re));

/** 1F1(a; a; z)/Γ(a) = e^z/Γ(a): (a)ₖ/Γ(a+k) = 1/Γ(a) termwise, so the regularized series sums to e^z/Γ(a). */
const regularizedDiagonal = (a: Cx, z: Cx): Cx => mul(cexp(z), invGamma(a));

/** Is b = a on the reals? */
const isDiagonal = (a: Cx, b: Cx): boolean => a.im === 0 && b.im === 0 && a.re === b.re;

/** 1/Γ(n) for an integer n: 0 at the poles n ≤ 0, else 1/(n − 1)! (infinite factorials flush to 0). */
function exactInvGammaAt(n: number): Cx {
  if (n <= 0) return cx(0);
  let f = 1;
  for (let i = 2; i < n; i++) f *= i;
  return cx(1 / f);
}

/**
 * pFq(upper; lower; z), the plain series. Declines (undefined) at a genuine pole — some lower
 * parameter landing on a non-positive integer that an upper parameter's own termination doesn't
 * already zero out — and when the series fails to settle inside `MAX_TERMS` (declines rather
 * than returning a number the tail hasn't converged to).
 */
export function pfqSeries(upper: readonly Cx[], lower: readonly Cx[], z: Cx): Cx | undefined {
  let term = cx(1, 0);
  let sum = cx(1, 0);
  let peak = 1; // the largest term seen, which sets the digits cancellation costs
  const vouch = (): Cx | undefined => (cancelled(peak, sum) ? undefined : sum);
  for (let k = 0; k < MAX_TERMS; k++) {
    if (term.re === 0 && term.im === 0) return vouch(); // terminated (a polynomial case)
    let num = z;
    for (const a of upper) num = mul(num, add(a, cx(k)));
    let den = cx(k + 1);
    let denPole = false;
    for (const b of lower) {
      const bk = add(b, cx(k));
      if (bk.re === 0 && bk.im === 0) {
        denPole = true;
        break;
      }
      den = mul(den, bk);
    }
    if (denPole) {
      if (num.re === 0 && num.im === 0) return vouch(); // numerator already vanished too: 0/0 is 0
      return undefined; // a genuine pole
    }
    term = div(mul(term, num), den);
    sum = add(sum, term);
    peak = Math.max(peak, mag(term));
    if (mag(term) < TOL * (1 + mag(sum))) return vouch();
  }
  return undefined; // did not converge inside the term budget
}

/**
 * pFq(upper; lower; z) / ∏Γ(lower), the regularized series — entire in every lower parameter by
 * construction, since `invGamma` is entire. Still declines on non-convergence.
 *
 * A lower parameter at a non-positive integer makes `invGamma(bj + k)` exactly 0 for every k up
 * to `-Re(bj)` — a real feature (the regularizing 1/Γ killing that term), not the tail settling.
 * Testing `|term| < tol` there would stop the sum right in that dead zone and miss every
 * non-zero term after it, so convergence is only checked once `k` has cleared the last such
 * pole (`poleBound`, below).
 *
 * The sum settles only after `SETTLED_RUN` consecutive shrinking terms whose geometric tail bound,
 * |term|·r/(1 − r) at the run's largest ratio r (at least |z| when p = q + 1), is under `TOL`
 * relative to the sum. One small term is not enough: a term can dip near a zero factor and grow again.
 */
function pfqRegularizedSeries(upper: readonly Cx[], lower: readonly Cx[], z: Cx): Cx | undefined {
  const poleBound = lower.reduce((m, b) => (isNonPositiveInt(b) ? Math.max(m, -b.re) : m), -1);
  let core = cx(1, 0); // ∏(ai)_k · zᵏ/k!, the part regularizing doesn't change
  let sum = cx(0, 0);
  let peak = 0; // the largest term seen, which sets the digits cancellation costs
  const vouch = (): Cx | undefined => (peak === 0 || !cancelled(peak, sum) ? sum : undefined);
  // A real-integer lower b has 1/Γ(b + k) exactly: 0 at the poles, 1/(n − 1)! after, stepped by
  // 1/Γ(x + 1) = (1/Γ(x))/x. A fresh exp(−lnΓ) per term would put its rounding (lnΓ is good to a few
  // ulps) into every term: Hypergeometric2F1Regularized(1, 2, −1, ½) came out 24 − 1.4e-14.
  const integerLower = lower.map((b) => b.im === 0 && Number.isInteger(b.re));
  const exactInvGamma = lower.map((b, i) => (integerLower[i] ? exactInvGammaAt(b.re) : cx(1)));
  let previous: number | undefined;
  let run = 0;
  let worstRatio = 0;
  const risingRatio = upper.length === lower.length + 1; // p = q + 1: the ratio tends to z
  const zSize = mag(z);
  for (let k = 0; k < MAX_TERMS; k++) {
    if (k > 0) {
      lower.forEach((b, i) => {
        if (integerLower[i]) exactInvGamma[i] = exactInvGammaAt(b.re + k);
      });
    }
    let invG = cx(1, 0);
    lower.forEach((b, i) => {
      invG = mul(invG, integerLower[i] ? exactInvGamma[i] : invGamma(add(b, cx(k))));
    });
    const term = mul(core, invG);
    sum = add(sum, term);
    peak = Math.max(peak, mag(term));
    if (core.re === 0 && core.im === 0) return vouch(); // terminated (a polynomial case)
    if (k > poleBound) {
      const size = mag(term);
      const ratio = previous === undefined ? 1 : size / previous;
      if (ratio < 1) {
        run += 1;
        worstRatio = run === 1 ? ratio : Math.max(worstRatio, ratio);
        // A p = q + 1 series' ratio rises toward |z| (DLMF 16.2), so the run's largest ratio alone
        // understates the tail: 2F1(1, 1; 2; z) has ratio (k + 1)z/(k + 2), still climbing at k.
        const bound = risingRatio ? Math.max(worstRatio, zSize) : worstRatio;
        if (run >= SETTLED_RUN && bound < 1 && (size * bound) / (1 - bound) <= TOL * mag(sum)) return vouch();
      } else {
        run = 0;
      }
      previous = size;
    }
    let num = z;
    for (const a of upper) num = mul(num, add(a, cx(k)));
    core = div(mul(core, num), cx(k + 1));
  }
  return undefined; // did not converge inside the term budget
}

const toCx = (x: BoxedExpression): Cx => cx(x.re, x.im);

/**
 * pFq(upper; b; z)/Γ(b) at the engine's precision, for the one-lower-parameter heads, when
 * `N(…, d)` asks for more digits than a double carries. Real operands only: a complex value
 * would still come back as a pair of doubles, so it declines (undefined) instead.
 */
function regularizedPastDouble(
  ce: ComputeEngine,
  upper: readonly BoxedExpression[],
  b: BoxedExpression,
  z: BoxedExpression,
): BoxedExpression | undefined {
  const ua = upper.map((a) => bigRealOperand(ce, a));
  const bb = bigRealOperand(ce, b);
  const zz = bigRealOperand(ce, z);
  if (bb === undefined || zz === undefined || ua.some((a) => a === undefined)) return undefined;
  const value = pfqRegularizedBig(ua as BigDecimal[], [bb], zz, ce.precision);
  return value === undefined ? undefined : bigResult(ce, value);
}

/** 1F1(a; b; z)/Γ(b) at the engine's precision for real operands, past a double's digits. */
function regularized1F1PastDouble(ce: ComputeEngine, ops: readonly BoxedExpression[]): BoxedExpression | undefined {
  const [a, b, z] = ops.map((op) => bigRealOperand(ce, op));
  if (a === undefined || b === undefined || z === undefined) return undefined;
  const value = hypergeometric1F1RegularizedBig(a, b, z, ce.precision);
  return value === undefined ? undefined : bigResult(ce, value);
}

/** 2F1(a, b; c; z)/Γ(c) at the engine's precision for real operands and z < 1, past a double's digits. */
function regularized2F1PastDouble(ce: ComputeEngine, ops: readonly BoxedExpression[]): BoxedExpression | undefined {
  const [a, b, c, z] = ops.map((op) => bigRealOperand(ce, op));
  if (a === undefined || b === undefined || c === undefined || z === undefined) return undefined;
  const value = hypergeometric2F1RegularizedBig(a, b, c, z, ce.precision);
  return value === undefined ? undefined : bigResult(ce, value);
}

/** 3F2(a₁, a₂, a₃; b₁, b₂; z)/(Γ(b₁)Γ(b₂)) at the engine's precision for real operands and |z| < 1. */
function regularized3F2PastDouble(ce: ComputeEngine, ops: readonly BoxedExpression[]): BoxedExpression | undefined {
  const [a1, a2, a3, b1, b2, z] = ops.map((op) => bigRealOperand(ce, op));
  if (a1 === undefined || a2 === undefined || a3 === undefined) return undefined;
  if (b1 === undefined || b2 === undefined || z === undefined) return undefined;
  const value = hypergeometric3F2RegularizedBig([a1, a2, a3], [b1, b2], z, ce.precision);
  return value === undefined ? undefined : bigResult(ce, value);
}

/** Shared operand plumbing: unbox to Cx, decline on a non-concrete or z = 0-with-pole operand. */
function operandsOf(ops: readonly BoxedExpression[]): Cx[] | undefined {
  if (ops.some((o) => o === undefined || !isFiniteNum(o))) return undefined;
  return ops.map(toCx);
}

/**
 * Wolfram's Bessel closed forms at exact arguments, for an exact z > 0:
 *   ₀F₁(;b;z)/Γ(b) = z^((1-b)/2) I_(b-1)(2√z) for a half-integer b, and
 *   ₁F₁(a;2a;z)/Γ(2a) = e^(z/2) Γ(a+1/2)/Γ(2a) (z/4)^(1/2-a) I_(a-1/2)(z/2) for a positive non-integer a.
 * Other shapes are left to the numeric series.
 */
function regularizedBessel(ce: ComputeEngine, ops: readonly BoxedExpression[]): BoxedExpression | undefined {
  const [z, b] = [ops.at(-1), ops.at(-2)];
  if (z === undefined || b === undefined || !(z.re > 0) || z.im !== 0 || z.unknowns.length > 0) return undefined;
  const lower = bigRationalAt(b);
  if (lower === undefined) return undefined;
  const half = ["Rational", 1, 2];
  if (ops.length === 2) {
    if (lower[1] !== 2n) return undefined;
    return ce
      .box([
        "Multiply",
        ["Power", z.json, ["Divide", ["Subtract", 1, b.json], 2]],
        ["BesselI", ["Subtract", b.json, 1], ["Multiply", 2, ["Sqrt", z.json]]],
      ] as never)
      .evaluate();
  }
  const a = ops[0]!;
  const upper = bigRationalAt(a);
  if (
    upper === undefined ||
    upper[1] === 1n ||
    upper[0] <= 0n ||
    !ce
      .function("Subtract", [b, ce.function("Multiply", [2, a])])
      .evaluate()
      .is(0)
  ) {
    return undefined;
  }
  return ce
    .box([
      "Multiply",
      ["Exp", ["Divide", z.json, 2]],
      ["Divide", ["Gamma", ["Add", a.json, half]], ["Gamma", b.json]],
      ["Power", ["Divide", z.json, 4], ["Subtract", half, a.json]],
      ["BesselI", ["Subtract", a.json, half], ["Divide", z.json, 2]],
    ] as never)
    .evaluate();
}

/** `regularizedMinusOne` on exact operands: b = a − 1 exactly, and a − 1 off the poles. */
function regularizedMinusOneExact(ce: ComputeEngine, ops: readonly BoxedExpression[]): BoxedExpression | undefined {
  const [a, b, z] = ops;
  if (a === undefined || b === undefined || z === undefined) return undefined;
  const shift = ce.function("Subtract", [a, 1]).evaluate();
  const shiftExact = bigRationalAt(shift);
  if (shiftExact === undefined || (shiftExact[1] === 1n && shiftExact[0] <= 0n)) return undefined;
  if (!ce.function("Subtract", [b, shift]).evaluate().is(0)) return undefined;
  return ce
    .box([
      "Multiply",
      ["Exp", z.json],
      ["Add", 1, ["Divide", z.json, shift.json]],
      ["Divide", 1, ["Gamma", shift.json]],
    ] as never)
    .evaluate();
}

/** `regularizedDiagonal` on exact operands: b = a exactly, and a off the poles. */
function regularizedDiagonalExact(ce: ComputeEngine, ops: readonly BoxedExpression[]): BoxedExpression | undefined {
  const [a, b, z] = ops;
  if (a === undefined || b === undefined || z === undefined) return undefined;
  const aExact = bigRationalAt(a);
  if (aExact === undefined || (aExact[1] === 1n && aExact[0] <= 0n)) return undefined;
  if (!ce.function("Subtract", [a, b]).evaluate().is(0)) return undefined;
  return ce.box(["Multiply", ["Exp", z.json], ["Divide", 1, ["Gamma", a.json]]] as never).evaluate();
}

export function declareHypergeometric(ce: ComputeEngine): void {
  // Hypergeometric0F1(b, z) = 0F1(b; z), entire in z; pole at b a non-positive integer.
  ce.declare("Hypergeometric0F1", {
    signature: "(number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      // ₀F₁(b; 0) = 1 for any b that isn't a pole (a symbolic b included).
      const [b0, z0] = ops;
      if (z0?.re === 0 && z0.im === 0 && b0 !== undefined && !(b0.re <= 0 && Number.isInteger(b0.re))) return ce.One;
      const cs = operandsOf(ops);
      if (cs === undefined || !wantsNumber(ops, options)) return undefined;
      const [b, z] = cs;
      // Past a double's digits only the bignum series answers; it declines rather than pad.
      if (exceedsDoublePrecision(ce, options.numericApproximation)) {
        const [bb, zz] = [bigRealOperand(ce, ops[0]!), bigRealOperand(ce, ops[1]!)];
        const value = bb === undefined || zz === undefined ? undefined : pfqBig([], bb, zz, ce.precision);
        return value === undefined ? undefined : bigResult(ce, value);
      }
      const r = pfqSeries([], [b], z);
      return r === undefined ? undefined : numberResult(ce, r);
    },
  });

  // Hypergeometric0F1Regularized(b, z) = 0F1(b; z) / Γ(b), entire in both b and z.
  ce.declare("Hypergeometric0F1Regularized", {
    signature: "(number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const cs = operandsOf(ops);
      if (cs !== undefined && !wantsNumber(ops, options)) return regularizedBessel(ce, ops);
      if (cs === undefined || !wantsNumber(ops, options)) return undefined;
      const [b, z] = cs;
      // Past a double's digits only the bignum series answers; it declines rather than pad.
      if (exceedsDoublePrecision(ce, options.numericApproximation))
        return regularizedPastDouble(ce, [], ops[0], ops[1]);
      const r = pfqRegularizedSeries([], [b], z);
      return r === undefined ? undefined : numberResult(ce, r);
    },
  });

  // Hypergeometric1F1Regularized(a, b, z) = 1F1(a, b; z) / Γ(b), entire in b and z.
  ce.declare("Hypergeometric1F1Regularized", {
    signature: "(number, number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const cs = operandsOf(ops);
      if (cs !== undefined && !wantsNumber(ops, options))
        return regularizedMinusOneExact(ce, ops) ?? regularizedDiagonalExact(ce, ops) ?? regularizedBessel(ce, ops);
      if (cs === undefined || !wantsNumber(ops, options)) return undefined;
      const [a, b, z] = cs;
      if (exceedsDoublePrecision(ce, options.numericApproximation)) return regularized1F1PastDouble(ce, ops);
      if (isMinusOneShift(a, b)) return numberResult(ce, regularizedMinusOne(a, z));
      if (isDiagonal(a, b)) return numberResult(ce, regularizedDiagonal(a, z));
      const r = pfqRegularizedSeries([a], [b], z);
      return r === undefined ? undefined : numberResult(ce, r);
    },
  });

  // Hypergeometric2F1Regularized(a, b, c, z) = 2F1(a, b, c; z) / Γ(c) (fungrim:fe6e74);
  // converges only for |z| < 1 (p = q + 1), so declines outside the unit disc.
  ce.declare("Hypergeometric2F1Regularized", {
    signature: "(number, number, number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      // 2F1(a, b; b; z) = (1 − z)⁻ᵃ, so the regularized form is (1 − z)⁻ᵃ / Γ(b): exact for exact
      // operands, and past |z| = 1 where the series gives out. Off the cut [1, ∞) of (1 − z)⁻ᵃ,
      // and not at a pole of Γ (where the regularized value is 0 instead).
      const [pa, pb, pc, pz] = ops;
      const exponent = pb?.isSame(pc) ? pa : pa?.isSame(pc) ? pb : undefined;
      const onCut = pz !== undefined && pz.im === 0 && pz.re >= 1;
      const atPole = pc !== undefined && pc.im === 0 && pc.re <= 0 && Number.isInteger(pc.re);
      if (exponent !== undefined && !onCut && !atPole && pz !== undefined && pc !== undefined) {
        const base = ce.function("Subtract", [ce.One, pz]);
        return ce
          .function("Divide", [ce.function("Power", [base, exponent.neg()]), ce.function("Gamma", [pc])])
          .evaluate();
      }
      const cs = operandsOf(ops);
      if (cs === undefined || !wantsNumber(ops, options)) return undefined;
      const [a, b, c, z] = cs;
      // Past a double's digits only the bignum kernel answers (real operands, z < 1).
      if (exceedsDoublePrecision(ce, options.numericApproximation)) return regularized2F1PastDouble(ce, ops);
      if (mag(z) >= 1) return undefined;
      const r = pfqRegularizedSeries([a, b], [c], z);
      return r === undefined ? undefined : numberResult(ce, r);
    },
  });

  // Hypergeometric3F2Regularized(a1, a2, a3, b1, b2, z) = 3F2(a1,a2,a3, b1,b2; z) / (Γ(b1)Γ(b2));
  // converges only for |z| < 1 (p = q + 1), so declines outside the unit disc.
  ce.declare("Hypergeometric3F2Regularized", {
    signature: "(number, number, number, number, number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const cs = operandsOf(ops);
      if (cs === undefined || !wantsNumber(ops, options)) return undefined;
      const [a1, a2, a3, b1, b2, z] = cs;
      // Past a double's digits only the bignum series answers (real operands, |z| < 1).
      if (exceedsDoublePrecision(ce, options.numericApproximation)) return regularized3F2PastDouble(ce, ops);
      if (mag(z) >= 1) return undefined;
      // Real operands: the terms carry factorial-sized factors whose rounding costs a double more
      // than its last bit (1, 2, 3; 4, −1; 1/3 came out 2 ulp off), so the bignum series answers at
      // `DOUBLE_GUARD_DIGITS` and rounds once; if it can't settle, neither can the double one.
      const real = ops.map((op) => bigRealOperand(ce, op));
      if (real.every((x) => x !== undefined)) {
        const v = hypergeometric3F2RegularizedBig(
          real.slice(0, 3) as [BigDecimal, BigDecimal, BigDecimal],
          real.slice(3, 5) as [BigDecimal, BigDecimal],
          real[5]!,
          DOUBLE_GUARD_DIGITS,
        );
        return v === undefined ? undefined : numberResult(ce, cx(v.toNumber(), 0));
      }
      const r = pfqRegularizedSeries([a1, a2, a3], [b1, b2], z);
      return r === undefined ? undefined : numberResult(ce, r);
    },
  });
}
