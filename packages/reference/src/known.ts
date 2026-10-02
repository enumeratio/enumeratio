// Whether an example's `expected` agrees with its `known` value: equal as expressions, an
// interval that tightly encloses the known one, or numerically within a tolerance.

import { BigDecimal, ComputeEngine } from "@cortex-js/compute-engine";
import { type MathJSON, solutionSet } from "@enumeratio/oracle/src";

const ce = new ComputeEngine();
// Relative above magnitude 1, absolute below it, so a value near 0 has a sensible bound.
export const DEFAULT_TOLERANCE = 1e-12;

/** A MathJSON number's exact decimal: a double's shortest digits, or a `{num}`'s own. */
const decimalOf = (json: unknown): BigDecimal =>
  new BigDecimal(typeof json === "number" ? String(json) : (json as { num: string }).num);

/**
 * An interval answer is a guaranteed enclosure, so it agrees with a known interval (the true
 * image) when it holds it -- no slack at all, in exact decimals -- and is tight: each end
 * within `tolerance` of the true one, relative above magnitude 1 and absolute below.
 */
function enclosure(ours: readonly unknown[], truth: readonly unknown[], tolerance: number): string | undefined {
  const [lo, hi] = ours.map(decimalOf) as [BigDecimal, BigDecimal];
  const [tlo, thi] = truth.map(decimalOf) as [BigDecimal, BigDecimal];
  if (!(lo.lte(tlo) && thi.lte(hi)))
    return `[${lo.toString()}, ${hi.toString()}] doesn't hold [${tlo.toString()}, ${thi.toString()}]`;
  const one = new BigDecimal("1");
  const size = [tlo.abs(), thi.abs(), one].reduce((m, x) => (x.gt(m) ? x : m));
  const slack = size.mul(new BigDecimal(String(tolerance)));
  if (tlo.sub(lo).gt(slack) || hi.sub(thi).gt(slack))
    return `[${lo.toString()}, ${hi.toString()}] isn't tight to ${tolerance}`;
  return undefined;
}

/** Whether `disagreement` can weigh `json` numerically: compute-engine alone gives it a
 * value. Not one in our own heads (`JacobiCN(2, 1/2)`), which this module never runs. */
export const comparable = (json: unknown): boolean => !Number.isNaN(ce.box(json as never).N().re);

/** The widest error bar, relative above magnitude 1, a measured `expected`
 * (`Measurement(value, error)`, a numeric integral) is read at. Past it (a Monte Carlo
 * ±0.018) the measurement is too rough to stand for the value. Shared with the oracle scan. */
export const MAX_MEASURED_TOLERANCE = 1e-6;
/** A few units in the last place of a double, relative above magnitude 1. */
const DOUBLE_ROUNDING = 4 * Number.EPSILON;

/** The tolerance a measured `expected` needs to be tight, or `undefined` for one that isn't
 * measured or is too rough (`MAX_MEASURED_TOLERANCE`). */
export function measuredTolerance(expected: unknown): number | undefined {
  if (!Array.isArray(expected) || expected[0] !== "Measurement") return undefined;
  const [value, error] = (expected as unknown[]).slice(1).map((x) => ce.box(x as never).N());
  if (value === undefined || error === undefined) return undefined;
  const relative = error.re / Math.max(1, Math.hypot(value.re, value.im || 0));
  if (!(relative >= 0)) return undefined;
  const tolerance = relative === 0 ? DEFAULT_TOLERANCE : 10 ** Math.ceil(Math.log10(relative));
  return tolerance <= MAX_MEASURED_TOLERANCE ? Math.max(tolerance, DEFAULT_TOLERANCE) : undefined;
}

/** Why `expected` doesn't agree with `known`, or `undefined` when it does. `call` is the
 * example's expression: a `Solve`'s answers are compared as a set, and a known value in
 * Wolfram's rules (`{{x -> 1}}`, `{{}}` for an identity) reads as ours does. */
export function disagreement(expected: unknown, known: unknown, tolerance: number, call?: unknown): string | undefined {
  if (Array.isArray(call) && call[0] === "Solve") {
    const solutions = (json: unknown): unknown => solutionSet(json as MathJSON, call as MathJSON);
    [expected, known] = [solutions(expected), solutions(known)];
  }
  const [a, b] = [ce.box(expected as never), ce.box(known as never)];
  if (a.isSame(b)) return undefined;
  const [p, q] = [a.json, b.json];
  // A measurement (a numeric integral) agrees when its error bar holds the known value and
  // is tight to `tolerance`. The bar is never narrower than the value's own double rounding:
  // compute-engine's quadrature reports ∫₁² ln³t/(t−1) dt as 0.14251419793571093 ± 1.4e-21.
  if (Array.isArray(p) && p[0] === "Measurement") {
    const [value, error] = (p as unknown[]).slice(1).map((x) => ce.box(x as never).N());
    const truth = b.N();
    if (value === undefined || error === undefined || Number.isNaN(truth.re))
      return `${a.toString()} is not ${b.toString()}`;
    const size = Math.max(1, Math.hypot(value.re, value.im || 0));
    const gap = Math.hypot(value.re - truth.re, (value.im || 0) - (truth.im || 0));
    if (gap > Math.max(error.re, DOUBLE_ROUNDING * size)) return `${a.toString()} doesn't hold ${truth.toString()}`;
    if (error.re > tolerance * Math.max(1, Math.hypot(truth.re, truth.im || 0)))
      return `${a.toString()} isn't tight to ${tolerance}`;
    return undefined;
  }
  if (Array.isArray(p) && Array.isArray(q) && p[0] === "Interval" && q[0] === "Interval")
    return enclosure((p as unknown[]).slice(1), (q as unknown[]).slice(1), tolerance);
  if (Array.isArray(p) && Array.isArray(q) && p[0] === "List" && q[0] === "List") {
    if (p.length !== q.length) return `${p.length - 1} elements, known ${q.length - 1}`;
    for (let i = 1; i < p.length; i++) {
      const why = disagreement(p[i], q[i], tolerance);
      if (why !== undefined) return `element ${i}: ${why}`;
    }
    return undefined;
  }
  // A set agrees element for element in any order (a `Solve`'s solutions).
  if (Array.isArray(p) && Array.isArray(q) && p[0] === "Set" && q[0] === "Set") {
    if (p.length !== q.length) return `${p.length - 1} elements, known ${q.length - 1}`;
    const unmatched: unknown[] = (q as unknown[]).slice(1);
    for (const element of (p as unknown[]).slice(1)) {
      const i = unmatched.findIndex((other) => disagreement(element, other, tolerance) === undefined);
      if (i < 0) return `${JSON.stringify(element)} is not among ${JSON.stringify(unmatched)}`;
      unmatched.splice(i, 1);
    }
    return undefined;
  }
  const [x, y] = [a.N(), b.N()];
  if (Number.isNaN(x.re) || Number.isNaN(y.re)) return `${JSON.stringify(a.json)} is not ${JSON.stringify(b.json)}`;
  // One distance for a complex value, not one per component: a component near 0 beside a
  // large other one would otherwise be held to an absolute bound.
  const size = (re: number, im: number): number => Math.hypot(re, im || 0);
  const gap = size(x.re - y.re, (x.im || 0) - (y.im || 0));
  const bound = tolerance * Math.max(size(x.re, x.im), size(y.re, y.im), 1);
  return gap <= bound ? undefined : `${x.toString()}, known ${y.toString()}`;
}
