import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, symbolNameOf } from "@enumeratio/boxed";
import { parseInterval, type Ivl } from "./optimize-core.ts";

// NMinimize/NMaximize -- numeric univariate optimization on a BOUNDED interval given as an
// explicit constraint (Wolfram's `{f, cons}` form; there is no bare `NMinimize(f, x)` here
// -- an unconstrained numeric search needs a starting box this file has no principled way
// to invent, so it declines rather than guess one). Multivariate declines outright.
//
// Method: sample `f` densely across the interval (`SAMPLES` points, endpoints included),
// then refine the best sample with a golden-section search bracketed by its two
// neighbours (or, when the best sample IS an endpoint, use it as-is -- no interior bracket
// exists to refine into). This finds the true global optimum whenever it lies in the
// basin the dense sampling already located; a function that packs more than `SAMPLES`
// oscillations into the interval, or has a spike narrower than the sampling grid, can
// still be missed -- a real limitation of a sampling-based search, not hidden here.
// Golden section converges to a bracket width under `TOL` (relative to the interval), well
// past `N(x)`'s usual precision for anything this file would attempt.

const SAMPLES = 201;
const TOL = 1e-11;
const MAX_ITER = 200;
const PHI = (Math.sqrt(5) - 1) / 2;

/** `f` evaluated numerically at `t` -- `undefined` when it's not a finite real there (a
 * domain edge, a pole, ...), which the search treats as "avoid this point" rather than a
 * hard failure. */
type NumFn = (t: number) => number | undefined;

const toNumFn =
  (ce: ComputeEngine, expr: BoxedExpression, x: string): NumFn =>
  (t: number) => {
    const v = expr
      .subs({ [x]: ce.number(t) })
      .evaluate()
      .N();
    return v.im === 0 && Number.isFinite(v.re) ? v.re : undefined;
  };

/** The minimizer of `f` over `[a, b]`, assumed unimodal on that bracket (true once the
 * dense sampling above has already isolated a single basin). Points where `f` is invalid
 * are treated as `+Infinity` -- worse than anything real, so the search steers away from
 * them without needing a separate feasibility check. */
function goldenSectionMin(f: NumFn, a: number, b: number): number {
  const g = (t: number): number => f(t) ?? Infinity;
  let lo = a;
  let hi = b;
  let c = hi - PHI * (hi - lo);
  let d = lo + PHI * (hi - lo);
  let fc = g(c);
  let fd = g(d);
  for (let i = 0; i < MAX_ITER && hi - lo > TOL * (1 + Math.abs(lo) + Math.abs(hi)); i++) {
    if (fc < fd) {
      hi = d;
      d = c;
      fd = fc;
      c = hi - PHI * (hi - lo);
      fc = g(c);
    } else {
      lo = c;
      c = d;
      fc = fd;
      d = lo + PHI * (hi - lo);
      fd = g(d);
    }
  }
  return (lo + hi) / 2;
}

function targetVar(varsArg: BoxedExpression): string | undefined {
  const bare = symbolNameOf(varsArg);
  if (bare !== undefined) return bare;
  if (varsArg.operator === "List") {
    const ops = operandsOf(varsArg);
    if (ops.length === 1) return symbolNameOf(ops[0]!);
  }
  return undefined;
}

/** `{f, cons}` with `cons` a BOUNDED simple interval -- the only form this file answers.
 * `undefined` declines: no constraint list, an unbounded or unparseable constraint, or a
 * malformed `{f, cons}`. */
function parseBoundedProblem(
  ce: ComputeEngine,
  firstArg: BoxedExpression,
  x: string,
): { expr: BoxedExpression; ivl: Ivl } | undefined {
  if (firstArg.operator !== "List") return undefined;
  const ops = operandsOf(firstArg);
  if (ops.length !== 2) return undefined;
  const ivl = parseInterval(ce, ops[1]!, x);
  if (ivl === undefined || ivl.lo.expr === undefined || ivl.hi.expr === undefined) return undefined;
  return { expr: ops[0]!, ivl };
}

function numericExtreme(
  ce: ComputeEngine,
  expr: BoxedExpression,
  x: string,
  ivl: Ivl,
  direction: "min" | "max",
): { value: number; point: number } | undefined {
  const raw = toNumFn(ce, expr, x);
  // For "max", search for the min of -f, then flip the value back at the end.
  const f: NumFn = direction === "min" ? raw : (t) => (raw(t) === undefined ? undefined : -raw(t)!);

  const lo = ivl.lo.approx;
  const hi = ivl.hi.approx;
  const samples: Array<{ t: number; v: number } | undefined> = [];
  for (let i = 0; i < SAMPLES; i++) {
    const t = lo + ((hi - lo) * i) / (SAMPLES - 1);
    const v = f(t);
    samples.push(v === undefined ? undefined : { t, v });
  }
  let bestIdx = -1;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (s === undefined) continue;
    if (bestIdx === -1 || s.v < samples[bestIdx]!.v) bestIdx = i;
  }
  if (bestIdx === -1) return undefined; // f had no finite real value anywhere on the grid

  const left = bestIdx > 0 ? (samples[bestIdx - 1]?.t ?? lo) : lo;
  const right = bestIdx < samples.length - 1 ? (samples[bestIdx + 1]?.t ?? hi) : hi;
  const point =
    bestIdx === 0 || bestIdx === samples.length - 1 ? samples[bestIdx]!.t : goldenSectionMin(f, left, right);
  const value = f(point);
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return direction === "min" ? { value, point } : { value: -value, point };
}

function declareOne(ce: ComputeEngine, name: string, direction: "min" | "max"): void {
  ce.declare(name, {
    signature: "(any, any) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [firstArg, varsArg] = ops;
      if (firstArg === undefined || varsArg === undefined) return undefined;
      const x = targetVar(varsArg);
      if (x === undefined) return undefined;
      const problem = parseBoundedProblem(ce, firstArg, x);
      if (problem === undefined) return undefined;
      const result = numericExtreme(ce, problem.expr, x, problem.ivl, direction);
      if (result === undefined) return undefined;
      return ce.function("List", [
        ce.number(result.value),
        ce.function("List", [ce.function("Rule", [ce.symbol(x), ce.number(result.point)])]),
      ]);
    },
  });
}

export function declareNMinMax(ce: ComputeEngine): void {
  declareOne(ce, "NMinimize", "min");
  declareOne(ce, "NMaximize", "max");
}
