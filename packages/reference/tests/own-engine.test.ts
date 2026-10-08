// Buildless src subpath, as entries.test.ts: the reference tests run before builds in CI.
import { expect, test } from "vite-plus/test";
import { ownEngineEntries, ownEngineOf, referenceData, referenceEntries } from "../src/node.ts";
import { evaluateOwn } from "../scripts/own-engines.ts";

test("statistics heads are own-engine heads: out of the reference engine's scan, in the own-engine one", () => {
  const data = referenceData();
  expect(ownEngineOf("WeibullDistribution", data)).toBe("statistics");
  expect(ownEngineOf("Sin", data)).toBeUndefined();
  expect(ownEngineEntries(data).map((entry) => entry.name)).toContain("WeibullDistribution");
  expect(referenceEntries(data).map((entry) => entry.name)).not.toContain("WeibullDistribution");
});

test("an own-engine head's pinned form evaluates in its package's engine; a call it rejects stays as pinned", () => {
  expect(evaluateOwn("statistics", ["SliceDistribution", ["WienerProcess", 1, 2], 3])).toEqual([
    "NormalDistribution",
    3,
    ["Multiply", 2, ["Sqrt", 3]],
  ]);
  expect(evaluateOwn("statistics", ["CDF", ["WienerProcess"], "x"])).toEqual(["CDF", ["WienerProcess"], "x"]);
});
