import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { type EvaluateOptions, operandsOf, symbolNameOf, wrapOperator } from "@enumeratio/boxed";
import { bindingOf, finish, mentions, numAt } from "./distributions.ts";

// The fifth wave of Wolfram-frontier probability heads, narrowed (mid-batch) to exactly two
// items: `NExpectation`/`NProbability` (numeric-only companions to `Expectation`/`Probability`,
// which stay exact-or-unevaluated — see distributions.ts's own doc comment on `Expectation`),
// and `Conditioned` used inside `Probability`/`Expectation` for P(A|B)/E(f|B). Everything else
// from the original batch (ProbabilityDistribution, Multinomial/Multinormal, ParameterMixture,
// Histogram) is OUT of scope for this file.
//
// Wolfram's forms: `NExpectation[f, x \[Distributed] dist]`, `NProbability[cond, x
// \[Distributed] dist]`, `Probability[a \[Conditioned] b, x \[Distributed] dist]` — i.e.
// `Conditioned[a, b]` ("a conditioned on b") as `Probability`'s or `Expectation`'s first
// argument, never a head of its own outside that position.
//
// No shared/exported quadrature utility exists yet (checked `@enumeratio/analytic`:
// `generalized-special.ts` has a private tanh-sinh integrator for the Nielsen polylog, not
// exported). This file has its own, generalized from a single unit interval to all four
// interval shapes (finite, semi-infinite either way, fully infinite) via the standard
// double-exponential (tanh-sinh) substitutions — same technique, not a shared helper.

const HALF_PI = Math.PI / 2;
/** Convergence + discrete tail-cutoff tolerance, documented on every numeric example. */
const TOLERANCE = 1e-12;

// --- shared: distribution shape knowledge ------------------------------------------------------
//
// Only what NExpectation/NProbability/Conditioned need to know about a distribution: whether
// it is discrete or continuous, and its support/domain. A narrow, local table — same spirit as
// distributions.ts's own `DISCRETE_KINDS` and distributions-4.ts's `DISCRETE_KINDS4` — not a
// general distribution-introspection API. Wave-4 compound distributions (Truncated, Mixture,
// Product, Transformed, Marginal, Dirichlet) are NOT covered: their PDF/CDF are extended
// generically, but their support shape isn't tabulated here, so this batch's heads stay
// unevaluated for them (a documented gap, not a bug).

interface Range {
  readonly lo: number;
  readonly hi: number;
}

/** Discrete kinds' supports, `hi` possibly `Infinity`. Params read positionally, matching each
 *  kind's own constructor as declared in distributions.ts/-2.ts/-3.ts. */
function discreteSupport(dist: BoxedExpression): Range | undefined {
  const ops = operandsOf(dist);
  switch (dist.operator) {
    case "BernoulliDistribution":
      return { lo: 0, hi: 1 };
    case "BinomialDistribution":
      return ops.length === 2 ? { lo: 0, hi: Math.round(numAt(ops[0])) } : undefined;
    case "DiscreteUniformDistribution": {
      if (ops.length !== 1 || ops[0].operator !== "List") return undefined;
      const bounds = operandsOf(ops[0]);
      return bounds.length === 2 ? { lo: Math.round(numAt(bounds[0])), hi: Math.round(numAt(bounds[1])) } : undefined;
    }
    case "HypergeometricDistribution": {
      if (ops.length !== 3) return undefined;
      const n = numAt(ops[0]);
      const nsucc = numAt(ops[1]);
      const ntot = numAt(ops[2]);
      return { lo: Math.max(0, Math.round(n - (ntot - nsucc))), hi: Math.round(Math.min(n, nsucc)) };
    }
    case "PoissonDistribution":
    case "GeometricDistribution":
    case "NegativeBinomialDistribution":
      return { lo: 0, hi: Infinity };
    default:
      return undefined;
  }
}

/** Continuous kinds' domains. */
function continuousDomain(dist: BoxedExpression): Range | undefined {
  const ops = operandsOf(dist);
  switch (dist.operator) {
    case "NormalDistribution":
    case "CauchyDistribution":
    case "LaplaceDistribution":
    case "LogisticDistribution":
    case "StudentTDistribution":
      return { lo: -Infinity, hi: Infinity };
    case "UniformDistribution":
      return ops.length === 2 ? { lo: numAt(ops[0]), hi: numAt(ops[1]) } : undefined;
    case "TriangularDistribution": {
      if (ops.length < 1 || ops[0].operator !== "List") return undefined;
      const bounds = operandsOf(ops[0]);
      return bounds.length === 2 ? { lo: numAt(bounds[0]), hi: numAt(bounds[1]) } : undefined;
    }
    case "BetaDistribution":
      return { lo: 0, hi: 1 };
    case "GammaDistribution":
    case "ExponentialDistribution":
    case "ChiSquareDistribution":
    case "ChiDistribution":
    case "ErlangDistribution":
    case "WeibullDistribution":
    case "RayleighDistribution":
    case "MaxwellDistribution":
    case "HalfNormalDistribution":
    case "LogNormalDistribution":
      return { lo: 0, hi: Infinity };
    case "ParetoDistribution":
      return ops.length === 2 ? { lo: numAt(ops[0]), hi: Infinity } : undefined;
    default:
      return undefined;
  }
}

// --- shared: double-exponential (tanh-sinh) quadrature ------------------------------------------
//
// Level-doubling tanh-sinh, generalized to finite/semi-infinite/fully-infinite intervals via
// the standard DE substitutions (Takahasi-Mori). Converges doubly-exponentially for smooth
// integrands, which is why the PDFs and indicator functions here (all bounded, and singular at
// worst at an integrable endpoint) are a good fit. Tolerance and level cap match the existing
// (private, unexported) `tanhSinhUnitInterval` in `@enumeratio/analytic`'s
// `generalized-special.ts` — same technique, independently implemented here since nothing is
// exported to reuse.

type PointWeight = (t: number) => { readonly x: number; readonly w: number };

function deQuadrature(xw: PointWeight, g: (x: number) => number): number {
  let h = 1;
  let prev = Number.NaN;
  let result = 0;
  for (let level = 0; level < 12; level++, h /= 2) {
    let sum = 0;
    const maxK = Math.min(Math.ceil(4.5 / h), 4000);
    for (let k = -maxK; k <= maxK; k++) {
      const { x, w } = xw(k * h);
      if (!Number.isFinite(w) || w === 0 || !Number.isFinite(x)) continue;
      const gv = g(x);
      if (Number.isFinite(gv)) sum += w * gv;
    }
    result = sum * h;
    if (Number.isFinite(prev) && Math.abs(result - prev) <= TOLERANCE * Math.max(1, Math.abs(result))) return result;
    prev = result;
  }
  return result;
}

const xwFinite =
  (a: number, b: number): PointWeight =>
  (t) => {
    const s = Math.sinh(t);
    const c = Math.cosh(t);
    const th = Math.tanh(HALF_PI * s);
    const sech2 = 1 - th * th; // sech^2(HALF_PI*sinh(t))
    const half = (b - a) / 2;
    return { x: (a + b) / 2 + half * th, w: half * HALF_PI * c * sech2 };
  };

/** [shift, +∞) when `mirror` is false; (-∞, shift] when `mirror` is true. */
const xwSemiInfinite =
  (shift: number, mirror: boolean): PointWeight =>
  (t) => {
    const s = Math.sinh(t);
    const c = Math.cosh(t);
    const e = Math.exp(HALF_PI * s);
    return { x: mirror ? shift - e : shift + e, w: HALF_PI * c * e };
  };

const xwFullInfinite: PointWeight = (t) => {
  const s = Math.sinh(t);
  const c = Math.cosh(t);
  const es = HALF_PI * s;
  return { x: Math.sinh(es), w: HALF_PI * c * Math.cosh(es) };
};

const pointWeightFor = (lo: number, hi: number): PointWeight => {
  if (Number.isFinite(lo) && Number.isFinite(hi)) return xwFinite(lo, hi);
  if (Number.isFinite(lo)) return xwSemiInfinite(lo, false);
  if (Number.isFinite(hi)) return xwSemiInfinite(hi, true);
  return xwFullInfinite;
};

/** ∫lo^hi g(x) dx over any of the four interval shapes. */
function integrateOverDomain(g: (x: number) => number, lo: number, hi: number): number {
  if (lo === hi) return 0;
  return deQuadrature(pointWeightFor(lo, hi), g);
}

/** Locates where a (possibly discontinuous) boolean `indicator` changes value across
 *  `[lo, hi]`, by sampling it at a moderate-density DE point set (the same substitution
 *  `integrateOverDomain` would use for this interval shape, so the sampling is naturally dense
 *  where it matters and sparse toward the tails) and bisecting between consecutive samples of
 *  opposite truth value. Tanh-sinh quadrature assumes a smooth integrand; `indicator * PDF` is
 *  NOT smooth at a condition's boundary (e.g. `x^2 > 1`), so integrating it directly loses most
 *  of the quadrature's accuracy right at the jump. Splitting at the jump first, and integrating
 *  each constant-truth piece on its own, restores full accuracy. */
function boundaryCrossings(indicator: (x: number) => boolean, lo: number, hi: number): number[] {
  const xw = pointWeightFor(lo, hi);
  const h = 1 / 64;
  const maxK = Math.min(Math.ceil(4.5 / h), 4000);
  const xs: number[] = [];
  for (let k = -maxK; k <= maxK; k++) {
    const { x } = xw(k * h);
    if (Number.isFinite(x)) xs.push(x);
  }
  xs.sort((a, b) => a - b);
  const crossings: number[] = [];
  for (let i = 1; i < xs.length; i++) {
    const a0 = xs[i - 1];
    const b0 = xs[i];
    const va = indicator(a0);
    if (va === indicator(b0)) continue;
    let a = a0;
    let b = b0;
    for (let iter = 0; iter < 60; iter++) {
      const mid = (a + b) / 2;
      if (indicator(mid) === va) a = mid;
      else b = mid;
    }
    crossings.push((a + b) / 2);
  }
  return crossings;
}

/** ∫lo^hi indicator(x)·pdf(x) dx, splitting at `indicator`'s boundary crossings first (see
 *  `boundaryCrossings`) so each piece `integrateOverDomain` sees is smooth. */
function integrateIndicator(
  pdf: (x: number) => number,
  indicator: (x: number) => boolean,
  lo: number,
  hi: number,
): number {
  const crossings = boundaryCrossings(indicator, lo, hi);
  const bounds = [lo, ...crossings, hi];
  let total = 0;
  for (let i = 0; i < bounds.length - 1; i++) {
    const a = bounds[i];
    const b = bounds[i + 1];
    if (a === b) continue;
    // A representative interior point to test truth on this segment — biased off an infinite
    // endpoint since `indicator` can't be evaluated exactly at ±∞.
    const probe = Number.isFinite(a) && Number.isFinite(b) ? (a + b) / 2 : Number.isFinite(a) ? a + 1 : b - 1;
    if (indicator(probe)) total += integrateOverDomain(pdf, a, b);
  }
  return total;
}

// --- shared: numeric evaluation of boxed expressions at a point ---------------------------------

const numericAt = (ce: ComputeEngine, expr: BoxedExpression, varName: string, x: number): number =>
  expr.subs({ [varName]: ce.number(x) }).N().re;

const pdfAt = (ce: ComputeEngine, dist: BoxedExpression, k: number): number =>
  ce
    .function("PDF", [dist, ce.number(k)])
    .evaluate()
    .N().re;

const indicatorAt = (ce: ComputeEngine, cond: BoxedExpression, varName: string, x: number): boolean =>
  symbolNameOf(cond.subs({ [varName]: ce.number(x) }).evaluate()) === "True";

/** Sum `valueAt(k, pdf(k))` over a discrete support, cutting an infinite tail off once the
 *  cumulative mass is within `TOLERANCE` of 1 AND the current term is below `TOLERANCE` — the
 *  same documented tolerance the quadrature above converges to. Capped at a million terms as a
 *  hard backstop (never reached for any distribution/parameter this package's examples use). */
function sumDiscrete(
  ce: ComputeEngine,
  dist: BoxedExpression,
  range: Range,
  valueAt: (k: number, pdf: number) => number,
): number {
  let sum = 0;
  let cumulative = 0;
  const hardCap = Number.isFinite(range.hi) ? range.hi : range.lo + 1_000_000;
  for (let k = range.lo; k <= hardCap; k++) {
    const p = pdfAt(ce, dist, k);
    sum += valueAt(k, p);
    cumulative += p;
    if (!Number.isFinite(range.hi) && cumulative > 1 - TOLERANCE && p < TOLERANCE) break;
  }
  return sum;
}

// --- NExpectation(f, Distributed(x, dist)) -------------------------------------------------------
//
// Numeric-only companion to `Expectation`: tries the exact head first (which is a real answer,
// not an approximation, whenever it resolves), and only falls back to summation/quadrature when
// `Expectation` itself stays symbolic — e.g. `f` past a linear/quadratic polynomial in `x`, or a
// distribution `Expectation` has no closed form for at all.

function nExpectationOf(
  ce: ComputeEngine,
  f: BoxedExpression,
  varName: string,
  dist: BoxedExpression,
): number | undefined {
  const exact = ce.function("Expectation", [f, ce.function("Distributed", [ce.symbol(varName), dist])]).evaluate();
  const exactNum = exact.N();
  if (Number.isFinite(exactNum.re) && exactNum.im === 0) return exactNum.re;

  const discreteRange = discreteSupport(dist);
  if (discreteRange !== undefined) {
    return sumDiscrete(ce, dist, discreteRange, (k, p) => numericAt(ce, f, varName, k) * p);
  }
  const domain = continuousDomain(dist);
  if (domain === undefined) return undefined;
  return integrateOverDomain((x) => numericAt(ce, f, varName, x) * pdfAt(ce, dist, x), domain.lo, domain.hi);
}

// --- NProbability(cond, Distributed(x, dist)) ----------------------------------------------------
//
// Same policy: try exact `Probability` first, fall back to summing/integrating the indicator of
// `cond` against the PDF — which works for any boolean condition compute-engine can evaluate at
// a numeric point (not just the `Equal`/`Less`/`LessEqual`/`And` shapes `Probability` itself
// recognizes symbolically).

function nProbabilityOf(
  ce: ComputeEngine,
  cond: BoxedExpression,
  varName: string,
  dist: BoxedExpression,
): number | undefined {
  const exact = ce.function("Probability", [cond, ce.function("Distributed", [ce.symbol(varName), dist])]).evaluate();
  const exactNum = exact.N();
  if (Number.isFinite(exactNum.re) && exactNum.im === 0) return exactNum.re;

  const discreteRange = discreteSupport(dist);
  if (discreteRange !== undefined) {
    return sumDiscrete(ce, dist, discreteRange, (k, p) => (indicatorAt(ce, cond, varName, k) ? p : 0));
  }
  const domain = continuousDomain(dist);
  if (domain === undefined) return undefined;
  return integrateIndicator(
    (x) => pdfAt(ce, dist, x),
    (x) => indicatorAt(ce, cond, varName, x),
    domain.lo,
    domain.hi,
  );
}

// --- Conditioned(a, b) inside Probability / Expectation -------------------------------------------
//
// `Conditioned[a, b]` ("a conditioned on b") is only meaningful as `Probability`'s or
// `Expectation`'s first argument — declared here as a bare inert constructor (same pattern as
// `Distributed` in distributions.ts) so it boxes at all; its own evaluation is the two wrappers
// below.
//
// `Probability(Conditioned(pred, cond), Distributed(x, dist))` = P(pred, cond) / P(cond), built
// entirely by calling back into the engine's own (already fully-extended) `Probability` head —
// so it inherits every discrete-PDF and closed-form-CDF case every wave before this one added,
// with no new distribution-shape knowledge needed here at all. Stays unevaluated whenever either
// call does (exactly the policy the task describes: "the discrete and closed-form-CDF cases the
// existing Probability handles; else unevaluated").

/** "Resolved" here means: not still sitting as a bare, unevaluated call to the head we asked for
 *  (`Probability`/`Expectation`). A partially-resolved expression built out of a still-symbolic
 *  `Mean`/`CDF`/etc. call is fine — that's a real (if unsimplified) algebraic answer. */
const isResolved = (expr: BoxedExpression, headOp: string): boolean => expr.operator !== headOp;

function conditionedProbability(
  ce: ComputeEngine,
  pred: BoxedExpression,
  cond: BoxedExpression,
  binding: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined {
  // `pred = Equal(x, k)`: P(X=k, cond)/P(cond) is just PDF(k)/P(cond), or 0 outright when `cond`
  // fails at `k` — evaluated directly rather than through `Probability`'s `And` case, which only
  // recognizes a conjunction of two `Less`/`LessEqual` relations (not `Equal` combined with
  // anything). Broadens the common "P(X=k | cond)" shape past that restriction.
  const b = bindingOf(binding);
  if (b !== undefined && pred.operator === "Equal") {
    const [a, bb] = operandsOf(pred);
    const point = symbolNameOf(a) === b.varName ? bb : symbolNameOf(bb) === b.varName ? a : undefined;
    if (point !== undefined && !mentions(point, b.varName)) {
      const denom = ce.function("Probability", [cond, binding]).evaluate();
      if (isResolved(denom, "Probability")) {
        if (!indicatorAt(ce, cond, b.varName, numAt(point))) return finish(ce.Zero, options);
        const pdfExpr = ce.function("PDF", [b.dist, point]).evaluate();
        return finish(ce.function("Divide", [pdfExpr, denom]), options);
      }
    }
  }

  const joint = ce.function("Probability", [ce.function("And", [pred, cond]), binding]).evaluate();
  if (!isResolved(joint, "Probability")) return undefined;
  const denom = ce.function("Probability", [cond, binding]).evaluate();
  if (!isResolved(denom, "Probability")) return undefined;
  return finish(ce.function("Divide", [joint, denom]), options);
}

/** `Expectation(Conditioned(f, cond), Distributed(x, dist))` = E[f | cond]. Two closed-form
 *  cases only (per the task's scope): `cond` pins `x` to an exact point (any distribution —
 *  conditioning on a point collapses `f` to its value there), or `cond` bounds `x` to a finite
 *  interval on a DISCRETE distribution (exact finite sum, reusing the same indicator evaluation
 *  `NProbability`/`NExpectation` use — no numeric approximation, since the sum has finitely
 *  many, exactly-known terms). A continuous distribution with an interval condition, or any
 *  distribution with an unbounded/complex condition, stays unevaluated — the exact machinery for
 *  a truncated *continuous* mean already lives in `distributions-4.ts`'s `TruncatedDistribution`,
 *  but composing through it here is out of scope for this batch. */
function conditionedExpectation(
  ce: ComputeEngine,
  f: BoxedExpression,
  cond: BoxedExpression,
  varName: string,
  dist: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined {
  if (cond.operator === "Equal") {
    const [a, b] = operandsOf(cond);
    const point = symbolNameOf(a) === varName ? b : symbolNameOf(b) === varName ? a : undefined;
    if (point === undefined || mentions(point, varName)) return undefined;
    return finish(f.subs({ [varName]: point }), options);
  }

  const range = discreteSupport(dist);
  if (range === undefined) return undefined; // continuous: out of scope here (see doc comment)

  const cap = finiteUpperCap(cond, varName);
  const lo = Math.max(range.lo, cap?.lower ?? range.lo);
  const hi = Number.isFinite(range.hi) ? range.hi : cap?.upper;
  if (hi === undefined) return undefined; // infinite tail, no cap from `cond`: not a finite sum

  let numerator = 0;
  let denominator = 0;
  for (let k = lo; k <= hi; k++) {
    if (!indicatorAt(ce, cond, varName, k)) continue;
    const p = pdfAt(ce, dist, k);
    numerator += numericAt(ce, f, varName, k) * p;
    denominator += p;
  }
  if (denominator === 0) return undefined;
  return finish(ce.number(numerator / denominator), options);
}

/** Extracts a finite `{lower?, upper?}` integer cap from a `Less`/`LessEqual`/`And`/chained
 *  condition on `varName` — just enough to bound an otherwise-infinite discrete support (e.g.
 *  `x <= 10` on a `PoissonDistribution`). Mirrors the bound-parsing distributions.ts's own
 *  (unexported) `probabilityOf` does for `Probability` itself; kept separate/smaller here since
 *  only the numeric cap is needed, not a probability. */
function finiteUpperCap(cond: BoxedExpression, varName: string): { lower?: number; upper?: number } | undefined {
  const asBound = (a: BoxedExpression, b: BoxedExpression) => {
    if (symbolNameOf(a) === varName && !mentions(b, varName)) return { k: b, varOnLeft: true };
    if (symbolNameOf(b) === varName && !mentions(a, varName)) return { k: a, varOnLeft: false };
    return undefined;
  };
  const toInt = (value: number, inclusive: boolean, isUpper: boolean): number => {
    if (inclusive) return isUpper ? Math.floor(value) : Math.ceil(value);
    return isUpper ? Math.floor(value - 1e-9) : Math.ceil(value + 1e-9);
  };

  if (cond.operator === "Less" || cond.operator === "LessEqual") {
    const ops = operandsOf(cond);
    const inclusive = cond.operator === "LessEqual";
    if (ops.length === 2) {
      const bound = asBound(ops[0], ops[1]);
      if (bound === undefined) return undefined;
      const value = numAt(bound.k);
      return bound.varOnLeft ? { upper: toInt(value, inclusive, true) } : { lower: toInt(value, inclusive, false) };
    }
    if (ops.length === 3) {
      const [a, xVar, b] = ops;
      if (symbolNameOf(xVar) !== varName || mentions(a, varName) || mentions(b, varName)) return undefined;
      return { lower: toInt(numAt(a), inclusive, false), upper: toInt(numAt(b), inclusive, true) };
    }
    return undefined;
  }
  if (cond.operator === "And") {
    const parts = operandsOf(cond);
    if (parts.length !== 2) return undefined;
    const b1 = finiteUpperCap(parts[0], varName);
    const b2 = finiteUpperCap(parts[1], varName);
    if (b1 === undefined || b2 === undefined) return undefined;
    return { lower: b1.lower ?? b2.lower, upper: b1.upper ?? b2.upper };
  }
  return undefined;
}

// --- declarations --------------------------------------------------------------------------------

function declareConstructors5(ce: ComputeEngine): void {
  // Same free-wildcard gotcha `distributions.ts` documents on `Distributed`'s own signature —
  // `any`, not `symbol`, for the bound-variable slot.
  ce.declare("Conditioned", { signature: "(any, any) -> expression<Conditioned>" });

  ce.declare("NExpectation", {
    signature: "(any, any) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => {
      if (ops.length !== 2) return undefined;
      const binding = bindingOf(ops[1]);
      if (binding === undefined) return undefined;
      const value = nExpectationOf(ce, ops[0], binding.varName, binding.dist);
      return value === undefined ? undefined : ce.number(value);
    },
  });

  ce.declare("NProbability", {
    signature: "(any, any) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => {
      if (ops.length !== 2) return undefined;
      const binding = bindingOf(ops[1]);
      if (binding === undefined) return undefined;
      const value = nProbabilityOf(ce, ops[0], binding.varName, binding.dist);
      return value === undefined ? undefined : ce.number(value);
    },
  });
}

function extendConditioned5(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["Probability"],
    (ops) => ops[0]?.operator === "Conditioned",
    (native) => (ops, options) => {
      const binding = bindingOf(ops[1]);
      if (binding === undefined) return native?.(ops, options);
      const [pred, cond] = operandsOf(ops[0]);
      const result = conditionedProbability(ce, pred, cond, ops[1], options);
      return result ?? native?.(ops, options);
    },
    2,
  );

  wrapOperator(
    ce,
    ["Expectation"],
    (ops) => ops[0]?.operator === "Conditioned",
    (native) => (ops, options) => {
      const binding = bindingOf(ops[1]);
      if (binding === undefined) return native?.(ops, options);
      const [f, cond] = operandsOf(ops[0]);
      const result = conditionedExpectation(ce, f, cond, binding.varName, binding.dist, options);
      return result ?? native?.(ops, options);
    },
    2,
  );
}

/** Declare the fifth-wave probability heads on `ce`: `NExpectation`, `NProbability`,
 *  `Conditioned` (inside `Probability`/`Expectation` only) — plus extending `Probability` and
 *  `Expectation` in place for the `Conditioned` case. Call AFTER `declareDistributions` (needs
 *  `Distributed`/`Probability`/`Expectation` already declared) and after any other wave whose
 *  distribution kinds should be reachable through `PDF`/`CDF` (waves 2-4 extend those in place,
 *  so declaring this last picks up all of them automatically). */
export function declareDistributions5(ce: ComputeEngine): void {
  declareConstructors5(ce);
  extendConditioned5(ce);
}
