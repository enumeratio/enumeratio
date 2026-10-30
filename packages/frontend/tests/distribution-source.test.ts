// The collection each carrier's statistic pages tally over, and a triangle as a page lists it:
// golden JSON compared with `toEqual` (AGENTS.md), regenerated with `UPDATE_DISTRIBUTION_SOURCE=1 vp test`.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readEntries, recordDirs } from "@enumeratio/entry/node";
import type { ReferenceEntry } from "@enumeratio/entry";
import { expect, test } from "vite-plus/test";
import { defaultRows, lastRowSvg, readTally, triangleLines, type Triangle } from "../src/distribution.ts";
import { catalogOf, distributionSourceOf } from "../src/explorer.ts";

const PACKAGES = fileURLToPath(new URL("../../", import.meta.url));
const byName = new Map<string, ReferenceEntry>();
for (const { dir } of recordDirs(PACKAGES))
  for (const e of readEntries(dir)) if (!byName.has(e.name)) byName.set(e.name, e);
const records = [...byName.values()];
const catalog = catalogOf(records);

const GOLDEN = fileURLToPath(new URL("./distribution-source.golden.json", import.meta.url));
const updating = process.env.UPDATE_DISTRIBUTION_SOURCE === "1";

const carriers = [...new Set(records.flatMap((r) => (r.carrier === undefined ? [] : [r.carrier])))].toSorted();

const rowOf = (n: number, values: number[], counts: number[]) => ({
  n,
  ...readTally(["Tuple", ["List", ...values], ["List", ...counts]]),
});
const triangle: Triangle = [
  rowOf(1, [0], [1]),
  rowOf(2, [0, 1], [1, 1]),
  rowOf(3, [1, 3], [4, 2]),
  { n: 4, ok: false, reason: "a distribution is computed up to size 3; this is size 4" },
];

test("the collection each carrier is tallied over, and a triangle as listed", async () => {
  const sources = Object.fromEntries(
    await Promise.all(
      carriers.map(async (c) => [c, (await distributionSourceOf(c, records, catalog)) ?? null] as const),
    ),
  );
  const fresh = {
    sources,
    lines: triangleLines(triangle),
    chart: lastRowSvg(triangle)?.includes("<svg") ?? false,
    defaultRows: [defaultRows(30), defaultRows(5), defaultRows(0)],
  };
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
  expect(fresh).toEqual(JSON.parse(readFileSync(GOLDEN, "utf8")));
});

test("permutations tally over the symmetric group, not the type-space plural", async () => {
  const source = await distributionSourceOf("Permutation", records, catalog);
  expect(source?.template).toBe("SymmetricGroup({size})");
});

test("a source has one open size slot and no other parameter", async () => {
  for (const c of carriers) {
    const source = await distributionSourceOf(c, records, catalog);
    if (source === undefined) continue;
    expect(source.template, c).toMatch(/^[A-Za-z]\w*\(\{size\}\)$/);
    expect(source.maxSize, c).toBeGreaterThan(0);
  }
});
