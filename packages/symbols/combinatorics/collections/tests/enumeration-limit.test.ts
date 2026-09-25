// A family whose unrank or rank enumerates declines on the engine past ENUMERATION_LIMIT, with
// `Head::toobig`, instead of materialising the family (design/plausible.md §9): the same path a
// notebook takes through At, Take and RandomChoice. Counts a plain-number kernel can't carry
// exactly are unknown to the engine rather than an internal error.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { collectMessages } from "@enumeratio/boxed";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = new ComputeEngine();
declareCollections(ce);

const run = (expr: unknown) => {
  const { value, messages } = collectMessages(ce, () => ce.box(expr as never).evaluate());
  return { json: value.json, texts: messages.map((m) => (m as { text?: string }).text ?? "") };
};

test("an affordable call still answers", () => {
  expect(run(["At", ["BoxedPlanePartitions", 2, 2, 2], 3]).json).toEqual(["List", ["List", 2]]);
  expect(run(["Count", ["BoxedPlanePartitions", 3, 3, 3]]).json).toBe(980);
});

test("past the limit, At declines and says why", () => {
  // BoxedPlanePartitions(5, 5, 5) has 267,227,532 elements: a count a double carries, and far
  // more than unrank should build to hand back one of them.
  const { texts } = run(["At", ["BoxedPlanePartitions", 5, 5, 5], 1]);
  expect(texts.join(" ")).toContain("BoxedPlanePartitions(5, 5, 5) would enumerate about 267,227,532 elements");
  expect(run(["Count", ["BoxedPlanePartitions", 5, 5, 5]]).json).toBe(267227532); // the count is closed-form
});

test("filtering the permutations counts n!, not the survivors", () => {
  expect(run(["At", ["BaxterPermutations", 12], 5]).texts.join(" ")).toContain("479,001,600");
});

test("Take and RandomChoice leave a huge family unevaluated", () => {
  expect(run(["Take", ["BoxedPlanePartitions", 7, 7, 7], 2]).json).toEqual([
    "Take",
    ["BoxedPlanePartitions", 7, 7, 7],
    2,
  ]);
  expect(run(["RandomChoice", ["BoxedPlanePartitions", 7, 7, 7], 1]).json).toEqual([
    "RandomChoice",
    ["BoxedPlanePartitions", 7, 7, 7],
    1,
  ]);
});

test("a count past 2^53 in a plain-number kernel is unknown, not an internal error", () => {
  expect(run(["Count", ["BoxedPlanePartitions", 7, 7, 7]]).json).toEqual(["Count", ["BoxedPlanePartitions", 7, 7, 7]]);
});
