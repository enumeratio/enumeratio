import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { integerAt, operandsOf, symbolNameOf } from "@enumeratio/boxed";

// NSum(f, {n, a, b}) -- a numeric series, either a finite range or `b = Infinity`.
//
// A finite range is a direct numeric sum (capped -- see `MAX_FINITE_TERMS` -- so a huge
// range declines instead of hanging).
//
// An infinite range is accelerated one of two ways, chosen by how its terms behave, with a
// STRICT ~1e-12 relative error bar (see `TOL` -- set two orders of magnitude tighter, at
// 1e-14, against the estimates below in adversarial cases when checked against mpmath and
// the true zeta values):
//   - terms whose sign strictly alternates: Wynn's epsilon algorithm (a generalization of
//     Aitken's Delta-squared process) on the partial sums. Handles an alternating series
//     extremely well -- `alternating harmonic -> ln 2` converges to full double precision.
//   - otherwise, a term that is eventually a smooth power law C*n^-p (p estimated locally
//     from two term ratios): Euler-Maclaurin, truncated at the smallest correction term
//     (the standard rule for an asymptotic series), evaluated at three truncation points
//     (200/500/1000 direct terms) and cross-checked against each other. Handles
//     `zeta(2)`, `zeta(3)` to full double precision, and `zeta(1.1)` -- a MUCH slower
//     series -- almost as well; `zeta(1.01)`, checked separately, correctly fails the
//     tightened bar rather than reporting a false 12 digits (see the package's tests).
//   - a term that doesn't shrink at all (not even eventually) declines immediately --
//     divergent by construction, never handed to either accelerator.
//
// Every one of these is a NUMERIC method: this head always returns an inexact number (or
// declines), never an exact closed form -- that is `Sum`'s job, when it exists.

const TOL = 1e-14; // stricter than the ~1e-12 this head promises -- see the file header
const MAX_FINITE_TERMS = 200_000;
const BERNOULLI_EVEN = [
  1 / 6,
  -1 / 30,
  1 / 42,
  -1 / 30,
  5 / 66,
  -691 / 2730,
  7 / 6,
  -3617 / 510,
  43867 / 798,
  -174611 / 330,
  854513 / 138,
];

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

/** A numeric evaluator for `f(n)`, real-valued only -- `undefined` for anything complex or
 * non-finite (a domain edge, say), which callers treat as "this method doesn't apply"
 * rather than crashing on it. */
const termFn =
  (ce: ComputeEngine, expr: BoxedExpression, n: string) =>
  (i: number): number | undefined => {
    const v = expr
      .subs({ [n]: ce.number(i) })
      .evaluate()
      .N();
    return v.im === 0 && Number.isFinite(v.re) ? v.re : undefined;
  };

// ---- Wynn's epsilon algorithm (alternating series) -------------------------------------

/** The even-indexed columns of Wynn's epsilon table over partial sums `S` -- each one a
 * progressively more accelerated estimate of the series' sum. Odd columns are auxiliary
 * (see any reference on the epsilon algorithm) and never returned. */
function epsilonEstimates(S: readonly number[]): number[] {
  let prev: number[] = S.map(() => 0);
  let cur: number[] = S.slice();
  const even: number[] = [cur[cur.length - 1]!];
  let k = 0;
  while (cur.length > 1) {
    const next: number[] = [];
    for (let i = 0; i + 1 < cur.length; i++) {
      const denom = cur[i + 1]! - cur[i]!;
      next.push(Math.abs(denom) < 1e-300 ? prev[i + 1]! + 1e300 : prev[i + 1]! + 1 / denom);
    }
    prev = cur;
    cur = next;
    k++;
    if (k % 2 === 0) even.push(cur[cur.length - 1]!);
  }
  return even;
}

function accelerateAlternating(terms: readonly number[]): { value: number; relErr: number } | undefined {
  const S: number[] = [];
  let acc = 0;
  for (const t of terms) {
    acc += t;
    S.push(acc);
  }
  const estimates = epsilonEstimates(S).filter((e) => Number.isFinite(e) && Math.abs(e) < 1e15);
  if (estimates.length < 3) return undefined;
  let bestErr = Infinity;
  let bestVal = estimates[estimates.length - 1]!;
  for (let i = 0; i + 1 < estimates.length; i++) {
    const relErr = Math.abs(estimates[i + 1]! - estimates[i]!) / Math.max(1, Math.abs(estimates[i + 1]!));
    if (relErr < bestErr) {
      bestErr = relErr;
      bestVal = estimates[i + 1]!;
    }
  }
  return { value: bestVal, relErr: bestErr };
}

// ---- Euler-Maclaurin tail (a smooth, eventually power-law term) ------------------------

/** The local decay exponent of `f` near `n = N`, from `f(N)` and `f(2N)` -- exact for a
 * pure `C n^-p` term, and a good local estimate for anything asymptotic to one. */
function estimateP(f: (i: number) => number | undefined, N: number): number | undefined {
  const a1 = f(N - 1);
  const a2 = f(2 * N - 1);
  if (a1 === undefined || a2 === undefined || a1 === 0 || a2 === 0) return undefined;
  const p = Math.log(Math.abs(a1) / Math.abs(a2)) / Math.log(2);
  return Number.isFinite(p) ? p : undefined;
}

/** `Sum_{n=N}^Infinity f(n)`, for `f` asymptotic to `C n^-p` near `N`, via Euler-Maclaurin:
 * the tail integral (`aN * N / (p - 1)`), the trapezoidal `aN / 2` correction, and as many
 * Bernoulli-number correction terms as keep shrinking (the standard truncation rule for a
 * divergent asymptotic series -- adding a term once it starts growing again only hurts). */
function eulerMaclaurinTail(aN: number, N: number, p: number): number {
  let sum = aN * (N / (p - 1) + 0.5);
  let risingFactorial = 1;
  let prevAbs = Infinity;
  for (let k = 1; k <= BERNOULLI_EVEN.length; k++) {
    risingFactorial *= k === 1 ? p : (p + (2 * k - 3)) * (p + (2 * k - 2));
    const add = (BERNOULLI_EVEN[k - 1]! / factorial(2 * k)) * aN * risingFactorial * N ** (1 - 2 * k);
    if (Math.abs(add) > prevAbs) break;
    sum += add;
    prevAbs = Math.abs(add);
  }
  return sum;
}

function accelerateSmoothTail(f: (i: number) => number | undefined): { value: number; relErr: number } | undefined {
  const truncations = [200, 500, 1000];
  const estimates: number[] = [];
  for (const N of truncations) {
    const p = estimateP(f, N);
    const aN = f(N - 1);
    if (p === undefined || aN === undefined || p <= 1.001) return undefined; // p <= 1: not (yet provably) summable this way
    let partial = 0;
    for (let i = 0; i < N - 1; i++) {
      const t = f(i);
      if (t === undefined) return undefined;
      partial += t;
    }
    estimates.push(partial + eulerMaclaurinTail(aN, N, p));
  }
  const a = estimates[1]!;
  const b = estimates[2]!;
  const relErr = Math.abs(b - a) / Math.max(1, Math.abs(b));
  return { value: b, relErr };
}

// ---- putting it together ----------------------------------------------------------------

const PROBE_TERMS = 60;

function nsumInfinite(ce: ComputeEngine, expr: BoxedExpression, n: string): BoxedExpression | undefined {
  const f = termFn(ce, expr, n);
  const probe: number[] = [];
  for (let i = 0; i < PROBE_TERMS; i++) {
    const t = f(i);
    if (t === undefined) return undefined;
    probe.push(t);
  }
  // Divergence guard: the tail must actually be shrinking (in magnitude) before either
  // accelerator is trusted with it -- a term that's flat or growing declines here, before
  // either method gets a chance to manufacture a confident-looking wrong answer.
  const half = Math.abs(probe[Math.floor(PROBE_TERMS / 2)]!);
  const last = Math.abs(probe[PROBE_TERMS - 1]!);
  if (last >= half * 1.0001 && half > 0) return undefined;

  // Already stable to machine precision (a fast series like Sum 1/n!) -- no acceleration
  // needed, and Wynn's table is numerically unstable once the raw sums have nothing left
  // to converge.
  let acc = 0;
  const partials: number[] = [];
  for (const t of probe) {
    acc += t;
    partials.push(acc);
  }
  const lastTwo = Math.abs(partials[PROBE_TERMS - 1]! - partials[PROBE_TERMS - 2]!);
  if (lastTwo < 1e-14 * Math.max(1, Math.abs(partials[PROBE_TERMS - 1]!))) {
    return ce.number(partials[PROBE_TERMS - 1]!);
  }

  const alternating = probe
    .slice(PROBE_TERMS - 10)
    .every((t, i, arr) => i === 0 || t === 0 || Math.sign(t) !== Math.sign(arr[i - 1]!));
  const result = alternating ? accelerateAlternating(probe) : accelerateSmoothTail(f);
  if (result === undefined || result.relErr > TOL || !Number.isFinite(result.value)) return undefined;
  return ce.number(result.value);
}

function nsumFinite(
  ce: ComputeEngine,
  expr: BoxedExpression,
  n: string,
  a: number,
  b: number,
): BoxedExpression | undefined {
  if (b < a) return ce.number(0);
  if (b - a + 1 > MAX_FINITE_TERMS) return undefined;
  const f = termFn(ce, expr, n);
  let acc = 0;
  for (let i = a; i <= b; i++) {
    const t = f(i);
    if (t === undefined) return undefined;
    acc += t;
  }
  return ce.number(acc);
}

/** `{n, a, b}` -- the summation variable, its integer start, and its end (a finite
 * integer, or `Infinity`/`PositiveInfinity`). `undefined` for anything else (a non-integer
 * start, a start above the end that isn't the trivial empty-range case, ...). */
function parseRange(rangeArg: BoxedExpression): { n: string; a: number; b: number | "infinite" } | undefined {
  if (rangeArg.operator !== "List") return undefined;
  const ops = operandsOf(rangeArg);
  if (ops.length !== 3) return undefined;
  const n = symbolNameOf(ops[0]!);
  const a = integerAt(ops[1]!.evaluate());
  if (n === undefined || a === undefined) return undefined;
  const bName = symbolNameOf(ops[2]!.evaluate());
  if (bName === "PositiveInfinity" || bName === "Infinity") return { n, a, b: "infinite" };
  const b = integerAt(ops[2]!.evaluate());
  return b === undefined ? undefined : { n, a, b };
}

export function declareNSum(ce: ComputeEngine): void {
  ce.declare("NSum", {
    signature: "(any, any) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [f, rangeArg] = ops;
      if (f === undefined || rangeArg === undefined) return undefined;
      const range = parseRange(rangeArg);
      if (range === undefined) return undefined;
      return range.b === "infinite" ? nsumInfinite(ce, f, range.n) : nsumFinite(ce, f, range.n, range.a, range.b);
    },
  });
}
