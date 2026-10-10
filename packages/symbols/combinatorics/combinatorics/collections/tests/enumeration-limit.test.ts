// A family whose unrank or rank enumerates declines on the engine past ENUMERATION_LIMIT, with
// `Head::toobig`, instead of materialising the family (https://github.com/enumeratio/enumeratio/wiki/Plausible §9): the same path a
// notebook takes through At, Take and RandomChoice. Counts a plain-number kernel can't carry
// exactly are unknown to the engine rather than an internal error.

import { bareEngine } from "@enumeratio/engine/testing";
import { collectMessages } from "@enumeratio/engine";
import { expect, test } from "vite-plus/test";
import { epsilEntries } from "../../permutations/src/families/core.ts";
import { kernelOn } from "../src/families/epsil.ts";
import { declareCombinatorics } from "../../src/index.ts";

// A-94: SymmetricGroup and BoxedPlanePartitions carry their own carriers now, so a bare
// declareCollections(ce) no longer declares them at all -- declareCombinatorics does, typed.
const ce = bareEngine();
declareCombinatorics(ce);
const symmetricGroup = kernelOn(
  ce,
  epsilEntries.find((family) => family.head === "SymmetricGroup")!,
);

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

test("a bigint kernel's count past 2^53 is exact, and its first 2^53 elements index", () => {
  expect(run(["Count", ["SymmetricGroup", 20]]).json).toEqual({ num: "2432902008176640000" });
  // Typed by its carrier now that declareCombinatorics declares Permutation too (A-94).
  expect(run(["At", ["SymmetricGroup", 20], 1]).json).toEqual([
    "Permutation",
    ["List", ...Array.from({ length: 20 }, (_, i) => i + 1)],
  ]);
  const last = run(["At", ["SymmetricGroup", 20], Number.MAX_SAFE_INTEGER]).json as [
    "Permutation",
    ["List", ...number[]],
  ];
  const [, word] = last;
  expect(word.length).toBe(21);
  expect(symmetricGroup.rank(word.slice(1), [20])).toBe(BigInt(Number.MAX_SAFE_INTEGER - 1));
});

test("a walking family answers a call far past what its fiber could be enumerated, but is not iterated whole", () => {
  // GelfandTsetlin(8, 8) and AlternatingSignMatrices(9) have far more members than the limit, and a call
  // walks a few thousand rows or subsets: At answers, Take and RandomChoice leave the family unevaluated.
  expect((run(["At", ["GelfandTsetlin", 8, 8], 5]).json as unknown as unknown[]).length).toBe(9);
  expect((run(["At", ["AlternatingSignMatrices", 9], 1000]).json as unknown as unknown[]).length).toBe(10);
  for (const family of [
    ["GelfandTsetlin", 8, 8],
    ["AlternatingSignMatrices", 9],
    ["GelfandTsetlin", 10, 10],
  ]) {
    expect(run(["Take", family, 2]).json).toEqual(["Take", family, 2]);
    expect(run(["RandomChoice", family, 1]).json).toEqual(["RandomChoice", family, 1]);
  }
  // A call that walks too far says so, in steps.
  expect(run(["At", ["AlternatingSignMatrices", 11], 5]).texts.join(" ")).toContain(
    "AlternatingSignMatrices(11) would take about 4,194,304 steps",
  );
});

test("a fiber past 2^53 whose elements a kernel declines is unknown to iteration, not empty", () => {
  // StandardTableaux(28) and StandardTableauPairs(19) count past 2^53 and decline every element.
  for (const family of [
    ["StandardTableaux", 28],
    ["StandardTableauPairs", 19],
  ]) {
    expect(run(["Take", family, 2]).json).toEqual(["Take", family, 2]);
    expect(run(["Count", family]).json).not.toBe(0);
  }
});
