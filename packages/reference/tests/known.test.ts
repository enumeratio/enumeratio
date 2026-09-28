// An example's `known` is a value it has from outside our own evaluation -- a DLMF identity, an
// OEIS term, a trusted kernel's high-precision digits -- with its `source`. `expected` pins what
// we compute; this holds it to the known value, so regenerating `expected` can't quietly move
// it off a value we know is right. Pure data: nothing here runs our heads.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { referenceData } from "../src/node.ts";

const ce = new ComputeEngine();
// Relative above magnitude 1, absolute below it, so a value near 0 has a sensible bound.
const DEFAULT_TOLERANCE = 1e-12;

/** Why `expected` doesn't agree with `known`, or `undefined` when it does. */
function disagreement(expected: unknown, known: unknown, tolerance: number): string | undefined {
  const [a, b] = [ce.box(expected as never), ce.box(known as never)];
  if (a.isSame(b)) return undefined;
  const [p, q] = [a.json, b.json];
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
  const close = (u: number, v: number): boolean =>
    u === v || Math.abs(u - v) <= tolerance * Math.max(Math.abs(u), Math.abs(v), 1);
  return close(x.re, y.re) && close(x.im, y.im) ? undefined : `${x.toString()}, known ${y.toString()}`;
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
});
