// The element picker each carrier gets: golden JSON compared with `toEqual` (AGENTS.md),
// regenerated with `UPDATE_CARRIER_PICKER=1 vp test` after an intended change.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readEntries, recordDirs } from "@enumeratio/entry/node";
import type { ReferenceEntry } from "@enumeratio/entry";
import { expect, test } from "vite-plus/test";
import {
  argumentOf,
  carrierOfType,
  carrierSlotOf,
  clampRank,
  elementText,
  hasPicker,
  MAX_RANK,
  pickerOf,
  rankBounds,
  withElement,
} from "../src/carrier-picker.ts";
import { catalogOf } from "../src/explorer.ts";
import { GLYPH_KINDS } from "../src/glyphs.ts";

const PACKAGES = fileURLToPath(new URL("../../", import.meta.url));
const byName = new Map<string, ReferenceEntry>();
for (const { dir } of recordDirs(PACKAGES))
  for (const e of readEntries(dir)) if (!byName.has(e.name)) byName.set(e.name, e);
const records = [...byName.values()];
const catalog = catalogOf(records);

const GOLDEN = fileURLToPath(new URL("./carrier-picker.golden.json", import.meta.url));
const updating = process.env.UPDATE_CARRIER_PICKER === "1";

const carriers = [...new Set(records.flatMap((r) => (r.carrier === undefined ? [] : [r.carrier])))].toSorted();
const pickers = await Promise.all(carriers.map(async (c) => [c, await pickerOf(c, records, catalog)] as const));

test("the picker each carrier gets, or why it has none", () => {
  const fresh = Object.fromEntries(pickers);
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
  expect(fresh).toEqual(JSON.parse(readFileSync(GOLDEN, "utf8")));
});

test("a picker draws from one open size slot, within the record's cap, with a known glyph", () => {
  for (const [c, picker] of pickers) {
    if (!hasPicker(picker)) continue;
    const cap = records.find((r) => r.name === picker.collection)?.maxSize;
    expect(picker.template, c).toMatch(/^[A-Za-z]\w*\(\{size\}\)$/);
    expect(picker.size.start, c).toBeGreaterThanOrEqual(picker.size.min);
    expect(picker.size.start, c).toBeLessThanOrEqual(picker.size.max);
    if (cap !== undefined) expect(picker.size.max, c).toBeLessThanOrEqual(cap);
    if (picker.glyph !== undefined) expect(GLYPH_KINDS.has(picker.glyph), c).toBe(true);
  }
});

test("a signature's carrier type names its carrier", () => {
  const names = new Set(["IntegerPartition", "Permutation"]);
  expect(carrierOfType("integer_partition", names)).toBe("IntegerPartition");
  expect(carrierOfType("(permutation)", names)).toBe("Permutation");
  expect(carrierOfType("permutation?", names)).toBe("Permutation");
  expect(carrierOfType("(permutation | cycle_decomposition)", names)).toBe("Permutation");
  expect(carrierOfType("integer", names)).toBeUndefined();
  expect(carrierOfType("list<permutation>", names)).toBeUndefined();
});

test("ranks run from 1 to the count, held to what a slider can place", () => {
  expect(rankBounds(0)).toBeUndefined();
  expect(rankBounds(24n)).toEqual({ min: 1, max: 24 });
  expect(rankBounds(10n ** 30n)).toEqual({ min: 1, max: MAX_RANK });
  expect(clampRank(99, 24)).toBe(24);
  expect(clampRank(0, 24)).toBe(1);
  expect(clampRank(Number.NaN, 24)).toBe(1);
  expect(elementText("SymmetricGroup({size})", 4, 7)).toBe("At(SymmetricGroup(4), 7)");
});

test("Try it picks for the first parameter typed as a carrier that has a picker", async () => {
  const carriers = new Set(["Permutation", "Word"]);
  const params = [{ type: "integer" }, { type: "word" }, { type: "permutation" }];
  const slot = await carrierSlotOf(params, carriers, records, catalog);
  expect(slot).toMatchObject({ index: 2, picker: { carrier: "Permutation", template: "SymmetricGroup({size})" } });
  expect(await carrierSlotOf([{ type: "integer" }], carriers, records, catalog)).toBeUndefined();
});

test("an example's carrier argument is found and swapped, in either spelling of a call", () => {
  const element = ["Permutation", ["List", 3, 1, 2]];
  const plain = ["Add", ["Descents", ["Permutation", ["List", 1, 2]]], 1];
  expect(argumentOf(plain, "Descents", 0)).toEqual(["Permutation", ["List", 1, 2]]);
  expect(argumentOf(plain, "Descents", 1)).toBeUndefined();
  expect(withElement(plain, "Descents", 0, element)).toEqual(["Add", ["Descents", element], 1]);
  const boxed = { fn: ["Descents", { fn: ["Permutation", { fn: ["List", 1, 2] }] }] };
  expect(withElement(boxed, "Descents", 0, element)).toEqual({ fn: ["Descents", element] });
  expect(plain[1]).toEqual(["Descents", ["Permutation", ["List", 1, 2]]]); // the original is untouched
  expect(withElement(plain, "Descents", 3, element)).toBe(plain);
  expect(withElement(plain, "Ascents", 0, element)).toBe(plain);
});
