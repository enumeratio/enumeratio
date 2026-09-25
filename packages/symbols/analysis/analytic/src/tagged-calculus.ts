import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";

// Shared calculus for Interval's monotonic-image rule and Around's first-order propagation:
// both need "the derivative of `head`'s `argIndex`-th argument, evaluated at a point" — the
// image rule to find the sign (and, if it flips, the one interior critical point) and the
// propagation rule to scale a delta. `derivativeAt` tries compute-engine's own symbolic `D`
// first (exact where it resolves: BarnesG, Gamma, Erf, the trig and hyperbolic families) and
// falls back to a central-difference numeric derivative for the heads `D` leaves as an inert
// `Apply(Derivative(...), …)` (DirichletEta, DirichletBeta, ErfInv, Zeta, PolyLog,
// GammaRegularized, BetaRegularized, Binomial, StieltjesGamma, HarmonicNumber, DirichletL) —
// checked in probe2.ts, not guessed. Either way the result is a plain number: only ever used
// to decide a sign or scale a delta, never returned as the value itself.

/** `head(ops)` with `ops[argIndex]` replaced by a boxed value, evaluated exactly (no `.N()`)
 * — this is what keeps an image's endpoints exact when the inputs are exact. */
function evalAt(
  ce: ComputeEngine,
  head: string,
  ops: readonly BoxedExpression[],
  argIndex: number,
  x: BoxedExpression,
): BoxedExpression {
  const args = ops.map((o, i) => (i === argIndex ? x : o));
  return ce.function(head, args).evaluate();
}

/** The same, but as a plain double — for derivative sampling and sign checks only. */
function numAt(ce: ComputeEngine, head: string, ops: readonly BoxedExpression[], argIndex: number, x: number): number {
  const args = ops.map((o, i) => (i === argIndex ? ce.number(x) : o));
  return ce.function(head, args).N().re;
}

/**
 * A reusable d/dx head(…, x, …)|ₓ evaluator, `x` in `ops[argIndex]`'s position: builds
 * compute-engine's symbolic `D` ONCE (when it resolves — exact for BarnesG, Gamma, Erf, the
 * trig and hyperbolic families) and just substitutes a fresh point into that same expression
 * on every call, rather than re-deriving it per sample — `imageOverArg` calls this dozens of
 * times per `Interval`, so re-running `D` itself each time would be the difference between one
 * symbolic differentiation and dozens. Falls back to a central difference per call for the
 * heads `D` leaves as an inert `Apply(Derivative(...), …)` (DirichletEta, DirichletBeta,
 * ErfInv, Zeta, PolyLog, GammaRegularized, BetaRegularized, Binomial, StieltjesGamma,
 * HarmonicNumber, DirichletL) — checked in probe2.ts, not guessed. The returned function gives
 * `undefined` when neither resolves at that point — decline, don't guess.
 */
export function makeDerivativeEvaluator(
  ce: ComputeEngine,
  head: string,
  ops: readonly BoxedExpression[],
  argIndex: number,
): (at: number) => number | undefined {
  let symbolic: BoxedExpression | undefined;
  try {
    const t = ce.symbol("_tagged_calculus_t");
    const argsWithT = ops.map((o, i) => (i === argIndex ? t : o));
    const f = ce.function(head, argsWithT);
    symbolic = ce.function("D", [f, t]).evaluate();
  } catch {
    symbolic = undefined;
  }
  return (at: number): number | undefined => {
    if (symbolic !== undefined) {
      try {
        const value = symbolic.subs({ _tagged_calculus_t: at }).N();
        if (Number.isFinite(value.re) && value.im === 0) return value.re;
      } catch {
        // fall through to the numeric derivative below
      }
    }
    try {
      const scale = Math.max(1e-6, Math.abs(at) * 1e-6);
      const plus = numAt(ce, head, ops, argIndex, at + scale);
      const minus = numAt(ce, head, ops, argIndex, at - scale);
      const d = (plus - minus) / (2 * scale);
      return Number.isFinite(d) ? d : undefined;
    } catch {
      return undefined;
    }
  };
}

/** One-shot convenience over `makeDerivativeEvaluator`, for a caller (Around's propagation)
 * that only ever needs the derivative at a single point and gains nothing from reuse. */
export function derivativeAt(
  ce: ComputeEngine,
  head: string,
  ops: readonly BoxedExpression[],
  argIndex: number,
  at: number,
): number | undefined {
  return makeDerivativeEvaluator(ce, head, ops, argIndex)(at);
}

const INVERSE_GOLDEN_RATIO = (Math.sqrt(5) - 1) / 2; // ≈ 0.618

/**
 * The extremum of `f` over `[a, b]`, given `f` is already known to be unimodal there (one
 * interior max-then-min or min-then-max, confirmed by a single derivative sign change across
 * the bracket — the caller's job, not this function's). `maximize` picks which. Golden-section
 * search, not derivative bisection: it costs one call to `f` itself per iteration instead of
 * one call to `f`'s DERIVATIVE, which matters because a derivative that falls back to a
 * central difference (DirichletEta, Zeta, …) is itself two calls to `f` — bisecting on it would
 * cost twice what searching on `f` directly does, for the same answer. 80 iterations decays the
 * bracket by `INVERSE_GOLDEN_RATIO^80` ≈ 1.4e-16 of its start width, comfortably past double
 * precision.
 */
function goldenSectionExtremum(
  f: (x: number) => number,
  a: number,
  b: number,
  maximize: boolean,
  iterations = 80,
): number {
  let lo = a;
  let hi = b;
  let c = hi - INVERSE_GOLDEN_RATIO * (hi - lo);
  let d = lo + INVERSE_GOLDEN_RATIO * (hi - lo);
  let fc = f(c);
  let fd = f(d);
  for (let i = 0; i < iterations; i++) {
    const cIsBetter = maximize ? fc > fd : fc < fd;
    if (cIsBetter) {
      hi = d;
      d = c;
      fd = fc;
      c = hi - INVERSE_GOLDEN_RATIO * (hi - lo);
      fc = f(c);
    } else {
      lo = c;
      c = d;
      fc = fd;
      d = lo + INVERSE_GOLDEN_RATIO * (hi - lo);
      fd = f(d);
    }
  }
  return (lo + hi) / 2;
}

/** Interior samples `imageOverArg` checks the derivative's sign at, besides the two
 * endpoints — dense enough to catch a second extremum in the ordinary case (a smooth special
 * function doesn't oscillate wildly across the width of a documented example's interval), but
 * this is still a finite sample, not a proof: `Cos` over a stretch spanning several periods is
 * exactly the shape this can't be trusted for, which is why the periodic heads (interval.ts's
 * `periodicImage`) enumerate their exact critical points instead of sampling for them. */
const SIGN_SAMPLES = 24;

/**
 * The image of `head(…, [l,h], …)` over `argIndex`. Samples the derivative's sign at the two
 * endpoints and `SIGN_SAMPLES` interior points: zero sign changes means monotonic (sort the
 * endpoints); exactly one means a single interior extremum, bisected within the specific
 * consecutive pair of samples that changed sign (Γ's minimum at x₀ ≈ 1.4616 inside [1.4, 1.5]
 * is this case); MORE than one sign change — or any sample where the derivative doesn't
 * resolve to a finite number at all — DECLINES rather than guess at a narrower-than-true
 * image. This is a finite sample, not a proof of the derivative's sign structure between
 * samples, so callers whose heads are known to be capable of many oscillations across a wide
 * argument range should rule that out themselves before calling this (see `periodicImage`).
 */
export function imageOverArg(
  ce: ComputeEngine,
  head: string,
  ops: readonly BoxedExpression[],
  argIndex: number,
  l: BoxedExpression,
  h: BoxedExpression,
): { lo: BoxedExpression; hi: BoxedExpression } | undefined {
  const lNum = l.N().re;
  const hNum = h.N().re;
  if (!Number.isFinite(lNum) || !Number.isFinite(hNum) || lNum > hNum) return undefined;
  if (lNum === hNum) {
    const point = evalAt(ce, head, ops, argIndex, l);
    return { lo: point, hi: point };
  }

  // One reusable derivative evaluator for every sample below — see makeDerivativeEvaluator's
  // own doc for why this matters: a fresh `derivativeAt` per sample would re-run symbolic `D`
  // itself SIGN_SAMPLES+2 times per `Interval` call, for no benefit (the expression it builds
  // doesn't depend on the sample point, only `subs` does).
  const derivative = makeDerivativeEvaluator(ce, head, ops, argIndex);

  // Sample points, endpoints included, evenly spaced.
  const xs: number[] = [lNum];
  for (let i = 1; i < SIGN_SAMPLES; i++) xs.push(lNum + ((hNum - lNum) * i) / SIGN_SAMPLES);
  xs.push(hNum);
  const derivatives = xs.map((x) => derivative(x));
  if (derivatives.some((d) => d === undefined || d === 0)) return undefined; // a sample landed
  // exactly on a critical point, or the derivative didn't resolve — decline rather than guess
  // which side of it the extremum falls on.
  const signs = derivatives.map((d) => ((d as number) > 0 ? 1 : -1));

  const candidates: BoxedExpression[] = [evalAt(ce, head, ops, argIndex, l), evalAt(ce, head, ops, argIndex, h)];
  let signChanges = 0;
  for (let i = 1; i < signs.length; i++) {
    if (signs[i] === signs[i - 1]) continue;
    signChanges++;
    if (signChanges > 1) return undefined; // more than one extremum in range: decline
    // + then - is a maximum; - then + is a minimum. Golden-section search on `head` itself,
    // not bisection on the derivative — see goldenSectionExtremum's own doc for why.
    const maximize = signs[i - 1] === 1;
    const valueAt = (x: number) => numAt(ce, head, ops, argIndex, x);
    const root = goldenSectionExtremum(valueAt, xs[i - 1]!, xs[i]!, maximize);
    candidates.push(evalAt(ce, head, ops, argIndex, ce.number(root)));
  }

  const numOf = (e: BoxedExpression) => e.N().re;
  const lo = candidates.reduce((a, b) => (numOf(b) < numOf(a) ? b : a));
  const hi = candidates.reduce((a, b) => (numOf(b) > numOf(a) ? b : a));
  return { lo, hi };
}
