// An example's `known` is a value it has from outside our own evaluation -- a DLMF identity, an
// OEIS term, a trusted kernel's high-precision digits -- with its `source`. `expected` pins what
// we compute; this holds it to the known value, so regenerating `expected` can't quietly move
// it off a value we know is right. Pure data: nothing here runs our heads.

import { expect, test } from "vite-plus/test";
import { comparable, DEFAULT_TOLERANCE, disagreement, measuredTolerance } from "../src/known.ts";
import { referenceData } from "../src/node.ts";

const known = referenceData().heads.flatMap(({ head, entry }) =>
  entry.examples.filter((e) => e.known !== undefined && e.role !== "triage").map((e) => ({ head, example: e })),
);

// A row may part from its `known` on purpose, and says so: `knownConvention` (compute-engine
// follows another convention than the source) or `knownGap` (a missing capability, `known` is the
// target). The marker is held both ways: an unmarked disagreement fails, and so does a marker on
// a row that agrees, which would be stale.
test("every example's expected agrees with its known value, or says why not", { timeout: 60_000 }, () => {
  const off = known.flatMap(
    ({ head, example: { id, expr, expected, known: value, tolerance, source, knownConvention, knownGap } }) => {
      const why = disagreement(expected, value, tolerance ?? DEFAULT_TOLERANCE, expr);
      const marked = knownConvention !== undefined || knownGap !== undefined;
      if (why !== undefined && !marked) return [`${head}/${id} (${source}): ${why}`];
      if (why === undefined && marked) return [`${head}/${id}: marked as parting from known, but agrees with it`];
      return [];
    },
  );
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
  const halfPi = ["Divide", "Pi", 2];
  expect(disagreement(["Measurement", 1.5707963267530112, 2.5e-10], halfPi, 1e-9)).toBeUndefined();
  expect(disagreement(["Measurement", 1.5707963167530112, 2.5e-10], halfPi, 1e-9)).toBeDefined(); // misses it
  expect(disagreement(["Measurement", 1.5707963267530112, 2.5e-10], halfPi, 1e-12)).toBeDefined(); // loose
});

test("a measured value's tolerance is its error bar, up to a decade", () => {
  expect(measuredTolerance(["Measurement", 1.5707963267530112, 2.5e-10])).toBe(1e-9);
  expect(measuredTolerance(["Measurement", -0.012, 0.018])).toBeUndefined(); // too rough
  expect(measuredTolerance(1.5)).toBeUndefined();
});

test("a value in heads compute-engine alone can't evaluate isn't comparable", () => {
  expect(comparable(["Divide", "Pi", 2])).toBe(true);
  expect(comparable(["Complex", { num: "0" }, { num: "-1.421802682497363661" }])).toBe(true);
  expect(comparable(["JacobiCN", 2, ["Rational", 1, 2]])).toBe(false);
});

test("a Solve's fresh parameter is Wolfram's unconstrained solution", () => {
  const identity = ["Solve", ["Equal", "x", "x"], "x"];
  expect(disagreement(["List", "t"], ["List", ["List"]], 1e-12, identity)).toBeUndefined();
  expect(disagreement(["List", "x"], ["List", ["List"]], 1e-12, identity)).toBeDefined();
  expect(disagreement(["List"], ["List", ["List"]], 1e-12, identity)).toBeDefined();
  const square = ["Solve", ["Equal", ["Power", "x", 2], 1], "x"];
  const rules = ["List", ["List", ["Rule", "x", -1]], ["List", ["Rule", "x", 1]]];
  expect(disagreement(["List", 1, -1], rules, 1e-12, square)).toBeUndefined();
});
