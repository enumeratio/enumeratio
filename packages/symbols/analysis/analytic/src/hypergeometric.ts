import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { type EvalOptions, isFiniteNum, numberResult, wantsNumber } from "./box.ts";
import { add, cexp, cx, type Cx, div, mul, scale } from "./complex.ts";
import { logGamma } from "./loggamma.ts";

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
// Convergence: p ≤ q (0F1, 1F1Regularized) is entire in z, so those never decline on account of
// z. p = q + 1 (2F1Regularized, 3F2Regularized) only converges for |z| < 1; z on or outside the
// unit circle is declined rather than answering with a wrong analytic continuation (Fungrim's own
// 2F1Regularized identities that reach past |z| = 1, e.g. fungrim:90ac58, rewrite to a *different*
// argument first — that is a job for the identity layer, not this evaluator).

const MAX_TERMS = 500;
const TOL = 1e-16;

/** Is z a non-positive integer — a pole of Γ, and so a zero of 1/Γ? */
const isNonPositiveInt = (z: Cx): boolean => z.im === 0 && z.re <= 0 && Number.isInteger(z.re);

/** 1/Γ(z), entire (zero at the non-positive integers, rather than the NaN a naive 1/Γ gets there). */
const invGamma = (z: Cx): Cx => (isNonPositiveInt(z) ? cx(0) : cexp(scale(logGamma(z), -1)));

const mag = (z: Cx): number => Math.hypot(z.re, z.im);

/**
 * pFq(upper; lower; z), the plain series. Declines (undefined) at a genuine pole — some lower
 * parameter landing on a non-positive integer that an upper parameter's own termination doesn't
 * already zero out — and when the series fails to settle inside `MAX_TERMS` (declines rather
 * than returning a number the tail hasn't converged to).
 */
export function pfqSeries(upper: readonly Cx[], lower: readonly Cx[], z: Cx): Cx | undefined {
  let term = cx(1, 0);
  let sum = cx(1, 0);
  for (let k = 0; k < MAX_TERMS; k++) {
    if (term.re === 0 && term.im === 0) return sum; // terminated (a polynomial case)
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
      if (num.re === 0 && num.im === 0) return sum; // numerator already vanished too: 0/0 is 0
      return undefined; // a genuine pole
    }
    term = div(mul(term, num), den);
    sum = add(sum, term);
    if (mag(term) < TOL * (1 + mag(sum))) return sum;
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
 */
function pfqRegularizedSeries(upper: readonly Cx[], lower: readonly Cx[], z: Cx): Cx | undefined {
  const poleBound = lower.reduce((m, b) => (isNonPositiveInt(b) ? Math.max(m, -b.re) : m), -1);
  let core = cx(1, 0); // ∏(ai)_k · zᵏ/k!, the part regularizing doesn't change
  let sum = cx(0, 0);
  for (let k = 0; k < MAX_TERMS; k++) {
    let invG = cx(1, 0);
    for (const b of lower) invG = mul(invG, invGamma(add(b, cx(k))));
    const term = mul(core, invG);
    sum = add(sum, term);
    if (core.re === 0 && core.im === 0) return sum; // terminated (a polynomial case)
    if (k > poleBound && mag(term) < TOL * (1 + mag(sum))) return sum;
    let num = z;
    for (const a of upper) num = mul(num, add(a, cx(k)));
    core = div(mul(core, num), cx(k + 1));
  }
  return undefined; // did not converge inside the term budget
}

const toCx = (x: BoxedExpression): Cx => cx(x.re, x.im);

/** Shared operand plumbing: unbox to Cx, decline on a non-concrete or z = 0-with-pole operand. */
function operandsOf(ops: readonly BoxedExpression[]): Cx[] | undefined {
  if (ops.some((o) => o === undefined || !isFiniteNum(o))) return undefined;
  return ops.map(toCx);
}

export function declareHypergeometric(ce: ComputeEngine): void {
  // Hypergeometric0F1(b, z) = 0F1(b; z), entire in z; pole at b a non-positive integer.
  ce.declare("Hypergeometric0F1", {
    signature: "(number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const cs = operandsOf(ops);
      if (cs === undefined || !wantsNumber(ops, options)) return undefined;
      const [b, z] = cs;
      const r = pfqSeries([], [b], z);
      return r === undefined ? undefined : numberResult(ce, r);
    },
  });

  // Hypergeometric0F1Regularized(b, z) = 0F1(b; z) / Γ(b), entire in both b and z.
  ce.declare("Hypergeometric0F1Regularized", {
    signature: "(number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const cs = operandsOf(ops);
      if (cs === undefined || !wantsNumber(ops, options)) return undefined;
      const [b, z] = cs;
      const r = pfqRegularizedSeries([], [b], z);
      return r === undefined ? undefined : numberResult(ce, r);
    },
  });

  // Hypergeometric1F1Regularized(a, b, z) = 1F1(a, b; z) / Γ(b), entire in b and z.
  ce.declare("Hypergeometric1F1Regularized", {
    signature: "(number, number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const cs = operandsOf(ops);
      if (cs === undefined || !wantsNumber(ops, options)) return undefined;
      const [a, b, z] = cs;
      const r = pfqRegularizedSeries([a], [b], z);
      return r === undefined ? undefined : numberResult(ce, r);
    },
  });

  // Hypergeometric2F1Regularized(a, b, c, z) = 2F1(a, b, c; z) / Γ(c) (fungrim:fe6e74);
  // converges only for |z| < 1 (p = q + 1), so declines outside the unit disc.
  ce.declare("Hypergeometric2F1Regularized", {
    signature: "(number, number, number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const cs = operandsOf(ops);
      if (cs === undefined || !wantsNumber(ops, options)) return undefined;
      const [a, b, c, z] = cs;
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
      if (mag(z) >= 1) return undefined;
      const r = pfqRegularizedSeries([a1, a2, a3], [b1, b2], z);
      return r === undefined ? undefined : numberResult(ce, r);
    },
  });
}
