import { staleEntries } from "@enumeratio/entry/node";
import { expect, test } from "vite-plus/test";
import { generated, REFERENCE_DIR } from "../scripts/entries.ts";

// Regenerate with `vp node packages/symbols/combinatorics/combinatorics/partitions/scripts/collect-entries.ts`.
test("the generated reference records are current", async () => {
  expect(await staleEntries(REFERENCE_DIR, generated.standard)).toEqual([]);
  expect(await staleEntries(REFERENCE_DIR, generated.curated)).toEqual([]);
});
