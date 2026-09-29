import { staleEntries } from "@enumeratio/entry/node";
import { expect, test } from "vite-plus/test";
import { generated } from "../scripts/domains-entries.ts";

// Regenerate with `vp node packages/symbols/combinatorics/statistics/scripts/collect-domains-entries.ts`.
// Lives here, not in combinatorics, alongside the generator itself (see domains-entries.ts).
test("combinatorics' domains-area generated reference records are current", async () => {
  expect(await staleEntries(new URL("../../combinatorics/reference/", import.meta.url), generated)).toEqual([]);
});
