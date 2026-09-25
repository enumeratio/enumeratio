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
function numAt(
  ce: ComputeEngine,
  head: string,
  ops: readonly BoxedExpression[],
  argIndex: number,
  x: number,
): number {
  const args = ops.map((o, i) => (i === argIndex ? ce.number(x) : o));
  return ce.function(head, args).N().re;
}

/**
 * d/dx head(…, x, …)|ₓ, `x` in `ops[argIndex]`'s position, evaluated at `at`. Tries symbolic
 * `D` first — resolves to a plain number when compute-engine knows a closed form; falls back
 * to a central difference when `D` can't (an unresolved `Apply(Derivative(...), …)` N()s to
 * NaN, which is the fallback's trigger). `undefined` means neither worked — decline, don't
 * guess.
 */
export function derivativeAt(
  ce: ComputeEngine,
  head: string,
  ops: readonly BoxedExpression[],
  argIndex: number,
  at: number,
): number | undefined {
  try {
    const t = ce.symbol("_tagged_calculus_t");
    const argsWithT = ops.map((o, i) => (i === argIndex ? t : o));
    const f = ce.function(head, argsWithT);
    const df = ce.function("D", [f, t]).evaluate();
    const value = df.subs({ _tagged_calculus_t: at }).N();
    if (Number.isFinite(value.re) && value.im === 0) return value.re;
  } catch {
    // fall through to the numeric derivative below
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
}

/**
 * One root of `f` in `[a, b]` by bisection, given `f(a)` and `f(b)` already differ in sign
 * (the caller's job to check — this doesn't). Used to locate the single interior extremum an
 * image rule needs when a derivative changes sign across an interval (e.g. Γ's minimum at
 * x₀ ≈ 1.4616 inside [1.4, 1.5]). 60 bisections is comfortably past double precision.
 */
export function bisectSignChange(
  f: (x: number) => number,
  a: number,
  b: number,
  iterations = 60,
): number | undefined {
  let lo = a;
  let hi = b;
  let flo = f(lo);
  if (!Number.isFinite(flo)) return undefined;
  if (flo === 0) return lo;
  for (let i = 0; i < iterations; i++) {
    const mid = (lo + hi) / 2;
    const fmid = f(mid);
    if (!Number.isFinite(fmid)) return undefined;
    if (fmid === 0) return mid;
    if (flo * fmid < 0) {
      hi = mid;
    } else {
      lo = mid;
      flo = fmid;
    }
  }
  return (lo + hi) / 2;
}

/**
 * The image of `head(…, [l,h], …)` over `argIndex`, using `derivativeAt` to find whether
 * `head` is monotonic across `[l, h]` — and, if the derivative changes sign, the one interior
 * critical point, via bisection on the derivative itself. Every candidate is evaluated
 * exactly at `evalAt` (a boxed endpoint stays exact; the bisected critical point, which
 * generally has no closed form, is a plain double either way). Declines (returns
 * `undefined`) whenever the derivative isn't finite at an endpoint, or the sign check itself
 * is inconclusive — never guesses past what the derivative actually shows.
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
  if (!Number.isFinite(lNum) || !Number.isFinite(hNum)) return undefined;
  const dl = derivativeAt(ce, head, ops, argIndex, lNum);
  const dh = derivativeAt(ce, head, ops, argIndex, hNum);
  if (dl === undefined || dh === undefined || dl === 0 || dh === 0) return undefined;
  const fl = evalAt(ce, head, ops, argIndex, l);
  const fh = evalAt(ce, head, ops, argIndex, h);
  const candidates: BoxedExpression[] = [fl, fh];
  if (dl * dh < 0) {
    const derivativeAtX = (x: number) => derivativeAt(ce, head, ops, argIndex, x) ?? Number.NaN;
    const root = bisectSignChange(derivativeAtX, lNum, hNum);
    if (root === undefined) return undefined;
    candidates.push(evalAt(ce, head, ops, argIndex, ce.number(root)));
  }
  const numOf = (e: BoxedExpression) => e.N().re;
  const lo = candidates.reduce((a, b) => (numOf(b) < numOf(a) ? b : a));
  const hi = candidates.reduce((a, b) => (numOf(b) > numOf(a) ? b : a));
  return { lo, hi };
}
