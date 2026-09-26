import { staleEntries } from "@enumeratio/entry/node";
import { expect, test } from "vite-plus/test";
import { generated } from "../scripts/entries.ts";

// Regenerate with `vp node packages/symbols/combinatorics/domains/scripts/collect-entries.ts`.
test("the generated reference records are current", async () => {
  expect(await staleEntries(new URL("../reference/", import.meta.url), generated)).toEqual([]);
});
