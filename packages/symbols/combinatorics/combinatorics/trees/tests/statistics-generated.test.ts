import { readEntry, staleEntries } from "@enumeratio/entry/node";
import { expect, test } from "vite-plus/test";
import { generated, REFERENCE_DIR } from "../scripts/entries.ts";

// Regenerate with `vp node packages/symbols/combinatorics/combinatorics/trees/scripts/collect-entries.ts`.
test("the generated reference records are current", async () => {
  expect(await staleEntries(REFERENCE_DIR, generated.standard)).toEqual([]);
  expect(await staleEntries(REFERENCE_DIR, generated.curated)).toEqual([]);
});

test("a head on both carriers keeps both carriers' catalog rows and statOn", () => {
  const entry = readEntry(REFERENCE_DIR, "ProtectionNumber");
  expect(entry.catalog?.map((row) => [row.identity, row.on])).toEqual([
    ["St000701", "BinaryTree"],
    ["St000700", "OrderedTree"],
  ]);
  expect(entry.statOn).toEqual(["BinaryTree", "OrderedTree"]);
});
