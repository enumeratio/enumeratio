// Whether an example's `expected` agrees with its `known` value: equal as expressions, an
// interval that tightly encloses the known one, or numerically within a tolerance.

import { BigDecimal, ComputeEngine } from "@cortex-js/compute-engine";

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

/** Why `expected` doesn't agree with `known`, or `undefined` when it does. */
export function disagreement(expected: unknown, known: unknown, tolerance: number): string | undefined {
  const [a, b] = [ce.box(expected as never), ce.box(known as never)];
  if (a.isSame(b)) return undefined;
  const [p, q] = [a.json, b.json];
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
  const [x, y] = [a.N(), b.N()];
  if (Number.isNaN(x.re) || Number.isNaN(y.re)) return `${JSON.stringify(a.json)} is not ${JSON.stringify(b.json)}`;
  // One distance for a complex value, not one per component: a component near 0 beside a
  // large other one would otherwise be held to an absolute bound.
  const size = (re: number, im: number): number => Math.hypot(re, im || 0);
  const gap = size(x.re - y.re, (x.im || 0) - (y.im || 0));
  const bound = tolerance * Math.max(size(x.re, x.im), size(y.re, y.im), 1);
  return gap <= bound ? undefined : `${x.toString()}, known ${y.toString()}`;
}
