// A map's behavior at small sizes, read from its images by the engine: golden JSON compared with
// `toEqual` (AGENTS.md), regenerated with `UPDATE_MAP_EXPLORER=1 vp test`. The facts are textbook
// ones -- inverse and reverse are involutions, Lalanne-Kreweras is one on Dyck paths, the
// Dyck-path/binary-tree conversion is a bijection -- so the golden data is checkable by eye.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { CARRIERS, declareCombinatorics, declareMaps } from "@enumeratio/combinatorics";
import { parseExpression } from "@enumeratio/formats/expression";
import { mapBadges, type MapRow } from "@enumeratio/frontend/core";
import { declareCarrierElement, declareCarrierPlurals, declareStructures } from "@enumeratio/structures";
import { afterAll, expect, test } from "vite-plus/test";
import { mapAtSize, mapProperties, type MapSource } from "../src/map-client.ts";

const GOLDEN = join(import.meta.dirname, "map-explorer.golden.json");
const updating = process.env.UPDATE_MAP_EXPLORER === "1";
const golden: Record<string, unknown> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, unknown> = {};

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
});

function check(id: string, actual: unknown): void {
  if (updating) fresh[id] = actual;
  else expect(actual).toEqual(golden[id]);
}

const ce = new ComputeEngine();
declareCombinatorics(ce);
declareCarrierPlurals(ce, CARRIERS);
declareCarrierElement(ce, CARRIERS);
declareMaps(ce, Object.fromEntries(CARRIERS.map((c) => [c.type, c.name])));
declareStructures(ce);

/** The engine as the page's kernel answers: Epsil text in, MathJSON out. */
async function evaluate(text: string): Promise<unknown> {
  const { json, errors } = parseExpression(text);
  if (errors.length > 0) throw new Error(errors.join("; "));
  return ce.box(json as never).evaluate().json;
}

const SIZES = [1, 2, 3, 4, 5];
const properties = (map: MapSource, sizes = SIZES): Promise<MapRow[]> => mapProperties(map, sizes, { evaluate });

/** The rows as a page lists them, with the badges they earn. */
const summary = (rows: MapRow[]) => ({
  rows: rows.map((r) => (r.ok ? { n: r.n, ...r.check } : r)),
  badges: mapBadges(rows),
});

test("Inverse on permutations is an involution", async () => {
  const rows = await properties({ name: "Inverse", template: "SymmetricGroup({size})", selfMap: true });
  check("Inverse", summary(rows));
  expect(mapBadges(rows)).toEqual(expect.arrayContaining(["bijection on all 5 sizes", "involution on all 5 sizes"]));
});

test("Reverse on permutations is an involution and a bijection onto the permutations", async () => {
  const rows = await properties({
    name: "Reverse",
    template: "SymmetricGroup({size})",
    selfMap: true,
    target: { template: "Permutations({size})", sizeOffset: 0 },
  });
  check("Reverse", summary(rows));
  expect(mapBadges(rows)).toEqual(expect.arrayContaining(["bijection on all 5 sizes", "involution on all 5 sizes"]));
});

test("Lalanne-Kreweras on Dyck paths is an involution", async () => {
  const rows = await properties({
    name: "LalanneKreweras",
    template: "DyckPaths({size})",
    selfMap: true,
    target: { template: "DyckPaths({size})", sizeOffset: 0 },
  });
  check("LalanneKreweras", summary(rows));
  expect(mapBadges(rows)).toContain("involution on all 5 sizes");
});

test("Promotion on Dyck paths has an order that grows with size, and is not an involution", async () => {
  const rows = await properties({
    name: "Promotion",
    template: "DyckPaths({size})",
    selfMap: true,
    target: { template: "DyckPaths({size})", sizeOffset: 0 },
  });
  check("Promotion", summary(rows));
  expect(mapBadges(rows).some((b) => b.startsWith("involution"))).toBe(false);
});

test("a known bijection between carriers: Dyck paths to binary trees", async () => {
  const rows = await properties({
    name: "BinaryTree",
    template: "DyckPaths({size})",
    target: { template: "BinaryTrees({size})", sizeOffset: 0 },
  });
  check("BinaryTree", summary(rows));
  expect(mapBadges(rows)).toContain("bijection on all 5 sizes");
});

test("a surjection that is not injective: binary search trees of permutations", async () => {
  const rows = await properties({
    name: "BinarySearchTree",
    template: "SymmetricGroup({size})",
    target: { template: "BinaryTrees({size})", sizeOffset: 0 },
  });
  check("BinarySearchTree", summary(rows));
  const last = rows.at(-1);
  expect(last?.ok && last.check.injective).toBe(false);
  expect(mapBadges(rows)).toEqual([]);
});

test("a table is the elements and their images, in step", async () => {
  const answer = await mapAtSize({ name: "Inverse", template: "SymmetricGroup({size})" }, 3, evaluate);
  expect(answer.ok).toBe(true);
  if (!answer.ok) return;
  check("table", {
    elements: answer.elements,
    images: answer.images,
  });
  expect(answer.images).toHaveLength(answer.elements.length);
});

test("a size past maxSize declines with a reason, and nothing is computed", async () => {
  let asked = 0;
  const counting = async (text: string): Promise<unknown> => (asked++, evaluate(text));
  const map = { name: "Inverse", template: "SymmetricGroup({size})", maxSize: 4 };
  expect(await mapAtSize(map, 5, counting)).toEqual({
    ok: false,
    reason: "a map is explored up to size 4; this is size 5",
  });
  expect(asked).toBe(0);
  const rows = await mapProperties(map, [3, 4, 5, 6], { evaluate });
  expect(rows.map((r) => [r.n, r.ok])).toEqual([
    [3, true],
    [4, true],
    [5, false],
  ]);
});

test("a collection past the row cap declines without applying the map", async () => {
  let mapped = false;
  const watching = async (text: string): Promise<unknown> => {
    if (text.includes("CombinatorialMap")) mapped = true;
    return evaluate(text);
  };
  const answer = await mapAtSize({ name: "Inverse", template: "SymmetricGroup({size})" }, 9, watching);
  expect(answer.ok).toBe(false);
  expect(mapped).toBe(false);
});

test("progress is reported a size at a time", async () => {
  const seen: number[] = [];
  await mapProperties({ name: "Inverse", template: "SymmetricGroup({size})" }, [1, 2, 3], {
    evaluate,
    progress: (n) => seen.push(n),
  });
  expect(seen).toEqual([1, 2, 3]);
});

test("a map the carrier does not have declines instead of reading nothing", async () => {
  const answer = await mapAtSize({ name: "NoSuchMap", template: "SymmetricGroup({size})" }, 3, evaluate);
  expect(answer).toEqual({ ok: false, reason: "NoSuchMap is not defined over SymmetricGroup(3)" });
});
