import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { assembleManifest, type PackageIndex } from "../src/assemble.ts";

const engine = { types: new Map([["Abs", "(number) -> number"]]), typing: new ComputeEngine() };

test("the manifest is assembled from each library's index, overloads attributed to the library that adds them", () => {
  const low: PackageIndex = {
    package: "low",
    records: [
      {
        record: {
          name: "Twist",
          summary: "A twist.",
          signature: "Twist(n)",
          signatures: [{ library: "@enumeratio/low", type: "(integer) -> integer" }],
        },
        examples: 2,
      },
    ],
  };
  const high: PackageIndex = {
    package: "high",
    notation: "@enumeratio/high/notation",
    records: [
      {
        record: {
          name: "Abs",
          summary: "Abs, widened.",
          signatures: [{ library: "enumeratio-high", type: "(list) -> list", overrides: "compute-engine" }],
        },
        examples: 0,
      },
    ],
  };
  const { symbols, declared, examples, notations } = assembleManifest([low, high], engine);
  expect(symbols.Twist).toEqual({
    name: "Twist",
    documented: ["low"],
    overloads: [{ package: "low", type: "(integer) -> integer" }],
    params: ["n"],
  });
  expect(symbols.Abs!.overloads.map((o) => o.package).toSorted()).toEqual(["compute-engine", "high"]);
  expect(declared.get("high")).toEqual({ Abs: { summary: "Abs, widened.", type: "(list) -> list" } });
  expect(examples.get("low")).toEqual({ Twist: 2 });
  expect(notations).toEqual({ high: "@enumeratio/high/notation" });
});
