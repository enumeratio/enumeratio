import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import { normal01, numAt, poissonSample } from "./distributions.ts";

// The Wolfram-frontier random-process heads: `WienerProcess`/`PoissonProcess` (inert process
// objects, same carrier-constructor idiom `distributions.ts` uses for a distribution), a
// process's slice distribution, and `RandomFunction`, which draws a seeded sample path.
//
// Wolfram writes a process's slice as `proc[t]` — direct function application, since a
// WienerProcess IS (semantically) a function from time to a distribution. Our engine has no
// general mechanism for calling an arbitrary declared symbol-headed expression as a function
// (that's `Apply`'s job, and only for heads that already declare a `function` type) — teaching
// `WienerProcess(...)` to respond to `(t)` application would mean deeper engine surgery than
// this batch's scope. Wolfram itself separately provides `SliceDistribution[proc, t]` for exactly
// this (searchable in its docs), so this file uses that real head as the bridge rather than
// inventing a new one: `SliceDistribution(proc, t)` evaluates DIRECTLY to the ordinary
// distribution answering that slice (`NormalDistribution`/`PoissonDistribution`), so PDF/CDF/
// Mean/Variance need no changes at all here — they see a distribution they already know.
//
// `RandomFunction(proc, {tmin, tmax})` / `(proc, {tmin, tmax, dt})` draws one seeded sample path
// and returns a PLAIN LIST of `{t, x}` pairs — `List(List(t0, x0), List(t1, x1), ...)` — not
// Wolfram's `TemporalData` object (an opaque, richer carrier with its own interpolation/display
// machinery that has no analogue here yet). A documented divergence, not an oversight. `dt`
// defaults to `(tmax - tmin) / 100` when omitted (Wolfram's own default resolution is adaptive;
// a fixed step count is what this package's other numeric defaults already do — see
// `distributions-5.ts`'s quadrature level cap for the same style of fixed, documented default).
//
// The path itself reuses `distributions.ts`'s own seeded PRNG stream (`normal01`, `uniform01`,
// `poissonSample`) rather than a second generator, so `SeedRandom` reseeds both RandomVariate
// and RandomFunction together. Paths are simulated by INDEPENDENT INCREMENTS over the grid —
// Euler–Maruyama for WienerProcess (`dX = mu dt + sigma sqrt(dt) Z`, exact in distribution for
// this process since its increments are exactly Gaussian, not merely approximate as
// Euler–Maruyama is for a general SDE), and `Poisson(lambda * dt)` per-step counts for
// PoissonProcess (exact in distribution too, since disjoint-interval counts of a Poisson
// process are themselves independent Poisson draws — no continuous-time jump-time bookkeeping
// needed). Reproducible for a fixed seed and grid; NOT bit-identical to Wolfram's own generator
// (same divergence `distributions.ts`'s `RandomVariate` already documents).

const DEFAULT_STEPS = 100;

/** `WienerProcess()` defaults to standard `(mu=0, sigma=1)`; `WienerProcess(mu, sigma)` gives
 *  both. No other arity is a valid call. */
export const wienerParams = (
  ce: ComputeEngine,
  proc: BoxedExpression,
): [BoxedExpression, BoxedExpression] | undefined => {
  const ops = operandsOf(proc);
  if (ops.length === 0) return [ce.Zero, ce.One];
  if (ops.length === 2) return [ops[0], ops[1]];
  return undefined;
};

export const poissonProcessRate = (proc: BoxedExpression): BoxedExpression | undefined => {
  const ops = operandsOf(proc);
  return ops.length === 1 ? ops[0] : undefined;
};

function declareProcessConstructors(ce: ComputeEngine): void {
  // Return type `distribution`, not `expression<WienerProcess>` — same reasoning
  // `distributions.ts`'s own constructors document: a bare `expression<Head>` doesn't let
  // this reach `SliceDistribution`'s `any` parameter, but declaring it nominally as a
  // `distribution` keeps it consistent with the rest of the frontier's carrier objects even
  // though a *process* (unlike a plain distribution) has no PDF/CDF/Mean/Variance of its own —
  // only its slices do, through `SliceDistribution`.
  ce.declare("WienerProcess", { signature: "(real?, real<0..>?) -> expression<WienerProcess>" });
  ce.declare("PoissonProcess", { signature: "(real<0..>) -> expression<PoissonProcess>" });
}

// --- SliceDistribution(proc, t): the ordinary distribution answering proc's slice at t --------

function sliceDistributionOf(
  ce: ComputeEngine,
  proc: BoxedExpression,
  t: BoxedExpression,
): BoxedExpression | undefined {
  switch (proc.operator) {
    case "WienerProcess": {
      const params = wienerParams(ce, proc);
      if (params === undefined) return undefined;
      const [mu, sigma] = params;
      return ce.function("NormalDistribution", [
        ce.function("Multiply", [mu, t]),
        ce.function("Multiply", [sigma, ce.function("Sqrt", [t])]),
      ]);
    }
    case "PoissonProcess": {
      const lambda = poissonProcessRate(proc);
      if (lambda === undefined) return undefined;
      return ce.function("PoissonDistribution", [ce.function("Multiply", [lambda, t])]);
    }
    default:
      return undefined;
  }
}

function declareSliceDistribution(ce: ComputeEngine): void {
  ce.declare("SliceDistribution", {
    signature: "(any, any) -> distribution",
    evaluate: (ops: readonly BoxedExpression[]) => {
      if (ops.length !== 2) return undefined;
      return sliceDistributionOf(ce, ops[0], ops[1])?.evaluate();
    },
  });
}

// --- RandomFunction(proc, {tmin, tmax}[, dt]): one seeded sample path --------------------------

/** `tmin, tmin+dt, ..., tmax` — the last step is whatever remains (may be short), matching
 *  Wolfram's own grid, which always lands exactly on `tmax`. */
function gridFor(tmin: number, tmax: number, dt: number | undefined): number[] {
  const step = dt ?? (tmax - tmin) / DEFAULT_STEPS;
  if (!(step > 0)) return [tmin];
  const grid: number[] = [];
  for (let t = tmin; t < tmax - 1e-9; t += step) grid.push(t);
  if (grid.length === 0 || grid[grid.length - 1] !== tmax) grid.push(tmax);
  return grid;
}

function simulatePath(ce: ComputeEngine, proc: BoxedExpression, grid: readonly number[]): number[] | undefined {
  switch (proc.operator) {
    case "WienerProcess": {
      const params = wienerParams(ce, proc);
      if (params === undefined) return undefined;
      const mu = numAt(params[0]);
      const sigma = numAt(params[1]);
      const xs = [0];
      for (let i = 1; i < grid.length; i++) {
        const dt = grid[i] - grid[i - 1];
        xs.push(xs[i - 1] + mu * dt + sigma * Math.sqrt(dt) * normal01(ce));
      }
      return xs;
    }
    case "PoissonProcess": {
      const lambdaExpr = poissonProcessRate(proc);
      if (lambdaExpr === undefined) return undefined;
      const lambda = numAt(lambdaExpr);
      const xs = [0];
      for (let i = 1; i < grid.length; i++) {
        const dt = grid[i] - grid[i - 1];
        xs.push(xs[i - 1] + poissonSample(ce, lambda * dt));
      }
      return xs;
    }
    default:
      return undefined;
  }
}

function declareRandomFunction(ce: ComputeEngine): void {
  ce.declare("RandomFunction", { signature: "(any, list<real>) -> any" });
  const definition = ce.lookupDefinition("RandomFunction");
  const operator = definition !== undefined && "operator" in definition ? definition.operator : undefined;
  if (operator === undefined) return;
  operator.evaluate = (ops: readonly BoxedExpression[]) => {
    if (ops.length !== 2) return undefined;
    const [proc, spec] = ops;
    if (spec.operator !== "List") return undefined;
    const specOps = operandsOf(spec);
    if (specOps.length !== 2 && specOps.length !== 3) return undefined;
    const tmin = numAt(specOps[0]);
    const tmax = numAt(specOps[1]);
    const dt = specOps.length === 3 ? numAt(specOps[2]) : undefined;
    if (!(tmax > tmin)) return undefined;
    const grid = gridFor(tmin, tmax, dt);
    const xs = simulatePath(ce, proc, grid);
    if (xs === undefined) return undefined;
    return ce.function(
      "List",
      grid.map((t, i) => ce.function("List", [ce.number(t), ce.number(xs[i])])),
    );
  };
}

/** Declare the random-process frontier heads on `ce`: `WienerProcess`, `PoissonProcess`,
 *  `SliceDistribution`, `RandomFunction`. Call AFTER `declareDistributions` (needs
 *  `NormalDistribution`/`PoissonDistribution`/`SeedRandom`'s PRNG stream already set up). */
export function declareProcesses(ce: ComputeEngine): void {
  declareProcessConstructors(ce);
  declareSliceDistribution(ce);
  declareRandomFunction(ce);
}
