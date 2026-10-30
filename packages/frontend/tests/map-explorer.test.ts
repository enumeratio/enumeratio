// The map explorer: what a map's page derives from the records (source collection, size bounds,
// glyphs) and what the properties check reads off a list of images. Golden JSON compared with
// `toEqual` (AGENTS.md), regenerated with `UPDATE_MAP_EXPLORER=1 vp test`.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readEntries, recordDirs } from "@enumeratio/entry/node";
import type { ReferenceEntry } from "@enumeratio/entry";
import { expect, test } from "vite-plus/test";
import { catalogOf, type MapField, mapExplorerOf } from "../src/explorer.ts";
import {
  checkMap,
  glyphSvg,
  keyOf,
  MAP_MAX_SIZE,
  mapBadges,
  mapDeclineReason,
  type MapRow,
  readCollection,
  readImages,
  showJson,
} from "../src/map-explorer.ts";

const PACKAGES = fileURLToPath(new URL("../../", import.meta.url));
const byName = new Map<string, ReferenceEntry>();
for (const { dir } of recordDirs(PACKAGES))
  for (const e of readEntries(dir)) if (!byName.has(e.name)) byName.set(e.name, e);
const records = [...byName.values()];
const catalog = catalogOf(records);

const GOLDEN = fileURLToPath(new URL("./map-explorer.golden.json", import.meta.url));
const updating = process.env.UPDATE_MAP_EXPLORER === "1";

const permutation = (...p: number[]) => ["Permutation", ["List", ...p]];
const list = (...items: unknown[]) => ["List", ["List", ...items]];

const fields: MapField[] = [
  { name: "Inverse", carrier: "Permutation", to: "Permutation" },
  { name: "LalanneKreweras", carrier: "DyckPath", to: "DyckPath", graded: { to: "DyckPaths", sizeOffset: 0 } },
  { name: "PrimeDyckPath", carrier: "DyckPath", to: "DyckPath", graded: { to: "DyckPaths", sizeOffset: 1 } },
  { name: "BinaryTree", carrier: "DyckPath", to: "BinaryTree", graded: { to: "BinaryTrees", sizeOffset: 0 } },
  { name: "Frontier", carrier: "Permutation", to: "Permutation", frontier: true },
  { name: "Nowhere", carrier: "NoSuchCarrier", to: "Permutation" },
];

/** A cycle of three, a swap, a collapse and a partial map, over `[0, 1, 2]`. */
const elements = [0, 1, 2].map((i) => permutation(i));
const checks = {
  cycle: checkMap(elements, [elements[1], elements[2], elements[0]], { sameCarrier: true }),
  swap: checkMap(elements, [elements[1], elements[0], elements[2]], { sameCarrier: true }),
  identity: checkMap(elements, elements, { sameCarrier: true }),
  collapse: checkMap(elements, [elements[0], elements[0], elements[1]], { sameCarrier: true }),
  partial: checkMap(elements, [elements[1], undefined, elements[0]], { sameCarrier: true }),
  crossCarrier: checkMap(elements, elements, { targetCount: 3n }),
  crossCarrierSmallerTarget: checkMap(elements, elements, { targetCount: 2n }),
  // Orders are lcms of cycle lengths: a 2-cycle beside a 3-cycle has order 6.
  lcm: checkMap(
    [1, 2, 3, 4, 5].map((i) => [i]),
    [[2], [1], [4], [5], [3]],
    { sameCarrier: true },
  ),
};

test("what a map's page derives, and what the properties check reads", async () => {
  const explorers = Object.fromEntries(
    await Promise.all(fields.map(async (f) => [f.name, (await mapExplorerOf(f, records, catalog)) ?? null] as const)),
  );
  const fresh = { explorers, checks };
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
  expect(fresh).toEqual(JSON.parse(readFileSync(GOLDEN, "utf8")));
});

test("a map is explored over its source carrier's collection, up to a bound a browser can map", async () => {
  const inverse = await mapExplorerOf(fields[0]!, records, catalog);
  expect(inverse?.template).toBe("SymmetricGroup({size})");
  expect(inverse?.selfMap).toBe(true);
  for (const f of fields) {
    const explorer = await mapExplorerOf(f, records, catalog);
    if (explorer === undefined) continue;
    expect(explorer.template, f.name).toMatch(/^[A-Za-z]\w*\(\{size\}\)$/);
    expect(explorer.maxSize, f.name).toBeLessThanOrEqual(MAP_MAX_SIZE);
    expect(explorer.start, f.name).toBeLessThanOrEqual(explorer.maxSize);
  }
  expect(await mapExplorerOf(fields[4]!, records, catalog)).toBeUndefined();
  expect(await mapExplorerOf(fields[5]!, records, catalog)).toBeUndefined();
});

test("a cycle has its length as order, a swap is an involution, a collapse has no order", () => {
  expect(checks.cycle).toMatchObject({ bijection: true, involution: false, order: "3" });
  expect(checks.swap).toMatchObject({ bijection: true, involution: true, order: "2" });
  expect(checks.identity).toMatchObject({ involution: true, order: "1" });
  expect(checks.collapse).toMatchObject({ injective: false, bijection: false });
  expect(checks.collapse.order).toBeUndefined();
  expect(checks.partial).toMatchObject({ defined: 2, selfMap: false });
  expect(checks.lcm.order).toBe("6");
});

test("onto needs the target's size, and a map to another carrier has no order", () => {
  expect(checks.crossCarrier).toMatchObject({ bijection: true, selfMap: false });
  expect(checks.crossCarrier.order).toBeUndefined();
  expect(checks.crossCarrierSmallerTarget.bijection).toBe(false);
  expect(checkMap(elements, elements).bijection).toBeUndefined();
});

test("badges hold only what every computed size shows", () => {
  const ok = (n: number, check: ReturnType<typeof checkMap>): MapRow => ({ n, ok: true, check });
  const declined: MapRow = { n: 9, ok: false, reason: "too big" };
  expect(mapBadges([ok(3, checks.swap), ok(4, checks.swap), declined])).toEqual([
    "bijection on all 2 sizes",
    "involution on all 2 sizes",
    "order 2 on all 2 sizes",
  ]);
  expect(mapBadges([ok(3, checks.swap), ok(4, checks.cycle)])).toEqual([
    "bijection on all 2 sizes",
    "order by size: 2, 3",
  ]);
  expect(mapBadges([declined])).toEqual([]);
});

test("a size past the bound, or a collection past the row cap, declines with a reason", () => {
  expect(mapDeclineReason({ size: 6, maxSize: 5 })).toBe("a map is explored up to size 5; this is size 6");
  expect(mapDeclineReason({ count: 5041n })).toContain("5,041");
  expect(mapDeclineReason({ size: 5, maxSize: 5, count: 120n })).toBeUndefined();
});

test("the engine's answers are read, glyphs drawn and values shown", () => {
  expect(readCollection(list(permutation(1, 2)))).toEqual([permutation(1, 2)]);
  expect(readCollection(["List", permutation(1, 2)])).toBeUndefined();
  expect(readImages(list(permutation(1), ["CombinatorialMap", "x", "'M'"]))).toEqual([permutation(1), undefined]);
  expect(keyOf(permutation(2, 1))).toBe(keyOf(["List", 2, 1]));
  expect(showJson(permutation(2, 1))).toBe("Permutation([2, 1])");
  expect(glyphSvg("permutation", permutation(2, 1, 3))).toContain("<svg");
  expect(glyphSvg("not-a-glyph", permutation(2, 1))).toBeUndefined();
  expect(glyphSvg(undefined, permutation(2, 1))).toBeUndefined();
});
