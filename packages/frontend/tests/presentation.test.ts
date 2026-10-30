// What automatic presentation picks for representative values: golden JSON compared with `toEqual`
// (AGENTS.md), regenerated with `UPDATE_PRESENTATION=1 vp test` after an intended change.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { CARRIERS, declareCombinatorics } from "@enumeratio/combinatorics";
import { declareCarrierElement, declareCarrierPlurals, declareStructures } from "@enumeratio/structures";
import { expect, test } from "vite-plus/test";
import { presentationOf } from "../src/presentation.ts";
import { openRowSource } from "../src/row-source.ts";
import { serializeExpression } from "@enumeratio/formats/expression";

const ce = new ComputeEngine();
declareCombinatorics(ce);
declareCarrierPlurals(ce, CARRIERS);
declareCarrierElement(ce, CARRIERS);
declareStructures(ce);

const ctx = {
  opensAsTable: (value: unknown) => openRowSource(ce, { collection: value as never, columns: [] }).ok,
  serialize: (value: unknown) => serializeExpression(value as never, { libraryNames: "mathjson" }),
};

// The JSON an evaluated value has: a lazy collection stays its call.
const VALUES: Record<string, unknown> = {
  "SymmetricGroup(3)": ["SymmetricGroup", 3],
  "IntegerPartitions(6)": ["IntegerPartitions", 6],
  "Subsets(4)": ["Subsets", 4],
  "Permutation([3, 1, 2])": ["Permutation", ["List", 3, 1, 2]],
  "IntegerPartition([3, 2, 1])": ["IntegerPartition", ["List", 3, 2, 1]],
  "list of numbers": ["List", 1, 2, 3],
  "list of pairs": ["List", ["List", 1, 2], ["List", 2, 4]],
  "list of reals": ["List", 0.5, 1.25, 2],
  "empty list": ["List"],
  "list of lists of different lengths": ["List", ["List", 1], ["List", 1, 2, 3]],
  "list of symbols": ["List", "a", "b"],
  set: ["Set", 1, 2],
  number: 5,
  symbol: "x",
  sum: ["Add", "x", 1],
  "undefined value": undefined,
};

const GOLDEN = fileURLToPath(new URL("./presentation.golden.json", import.meta.url));

test("the view each value gets", () => {
  const fresh = Object.fromEntries(
    Object.entries(VALUES).map(([label, value]) => [label, presentationOf(value, ctx) ?? null]),
  );
  if (process.env.UPDATE_PRESENTATION === "1") writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
  expect(fresh).toEqual(JSON.parse(readFileSync(GOLDEN, "utf8")));
});

test("a collection head the engine cannot open as a table is left as typeset", () => {
  expect(presentationOf(["SymmetricGroup", 3], { ...ctx, opensAsTable: () => false })).toBeUndefined();
});
