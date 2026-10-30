// The built carrier-statistics table agrees with the records: each carrier's statistics are the
// first few `catalogOf` offers, and each head names a carrier that has some.

import { fileURLToPath } from "node:url";
import { readEntries, recordDirs } from "@enumeratio/entry/node";
import type { ReferenceEntry } from "@enumeratio/entry";
import { expect, test } from "vite-plus/test";
import { automaticStatistics } from "../src/carrier-statistics.ts";
import { catalogOf } from "../src/explorer.ts";
import { DEFAULT_COLUMNS } from "../src/table-state.ts";

const PACKAGES = fileURLToPath(new URL("../../", import.meta.url));
const byName = new Map<string, ReferenceEntry>();
for (const { dir } of recordDirs(PACKAGES))
  for (const e of readEntries(dir)) if (!byName.has(e.name)) byName.set(e.name, e);
const records = [...byName.values()];
const catalog = catalogOf(records);

test("a carrier opens with its first statistics, and a collection head reads its carrier's", () => {
  const withStatistics = records.filter(
    (r) => r.carrier !== undefined && catalog.statisticsOn(r.carrier).length > 0 && r.name !== r.carrier,
  );
  expect(withStatistics.length).toBeGreaterThan(0);
  for (const r of withStatistics) {
    const expected = catalog
      .statisticsOn(r.carrier!)
      .slice(0, DEFAULT_COLUMNS)
      .map((s) => s.name);
    expect(automaticStatistics("", `${r.name}(3)`), r.name).toEqual(expected);
    expect(automaticStatistics(r.carrier!, "")).toEqual(expected);
  }
});

test("an unknown carrier and head offer nothing", () => {
  expect(automaticStatistics("", "NonNegativeIntegers")).toEqual([]);
  expect(automaticStatistics("", "")).toEqual([]);
});
