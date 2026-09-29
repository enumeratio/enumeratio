// An example's `known` is a value it has from outside our own evaluation -- a DLMF identity, an
// OEIS term, a trusted kernel's high-precision digits -- with its `source`. `expected` pins what
// we compute; this holds it to the known value, so regenerating `expected` can't quietly move
// it off a value we know is right. Pure data: nothing here runs our heads.

import { BigDecimal, ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { referenceData } from "../src/node.ts";

const ce = new ComputeEngine();
// Relative above magnitude 1, absolute below it, so a value near 0 has a sensible bound.
const DEFAULT_TOLERANCE = 1e-12;

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
function disagreement(expected: unknown, known: unknown, tolerance: number): string | undefined {
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

const known = referenceData().heads.flatMap(({ head, entry }) =>
  entry.examples.filter((e) => e.known !== undefined).map((e) => ({ head, example: e })),
);

test("every example's expected agrees with its known value", { timeout: 60_000 }, () => {
  const off = known.flatMap(({ head, example: { id, expected, known: value, tolerance, source } }) => {
    const why = disagreement(expected, value, tolerance ?? DEFAULT_TOLERANCE);
    return why === undefined ? [] : [`${head}/${id} (${source}): ${why}`];
  });
  expect(off).toEqual([]);
});

test("the comparison rejects what it should", () => {
  expect(
    disagreement(["Multiply", ["Rational", 1, 6], ["Power", "Pi", 2]], ["Divide", ["Power", "Pi", 2], 6], 1e-12),
  ).toBeUndefined();
  expect(disagreement(1.6449340668482264, ["Divide", ["Power", "Pi", 2], 6], 1e-12)).toBeUndefined();
  expect(disagreement(1.6449340668, ["Divide", ["Power", "Pi", 2], 6], 1e-12)).toBeDefined();
  expect(disagreement(["List", 1, 2], ["List", 1, 3], 1e-12)).toBeDefined();
  expect(disagreement(["Rational", 1, 90], ["Rational", 1, 6], 1e-12)).toBeDefined();
  const truth = ["Interval", { num: "1.0522163286861942" }, { num: "1.0541936064356910" }];
  expect(disagreement(["Interval", 1.05221632868619, 1.0541936064357], truth, 1e-9)).toBeUndefined();
  expect(disagreement(["Interval", 1.0522163286862, 1.0541936064357], truth, 1e-9)).toBeDefined(); // misses the low end
  expect(disagreement(["Interval", 1.0522, 1.0542], truth, 1e-9)).toBeDefined(); // holds it, but loose
});
