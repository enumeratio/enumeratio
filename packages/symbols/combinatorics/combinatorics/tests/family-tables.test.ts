// A family's `tables` are computed once per distinct params and read by every call: from a
// small bounded cache per kernel, as doubles for compiled code and exact for the interpreter.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { COMPILED_FAMILIES } from "../collections/src/families/compiled-families.generated.js";
import {
  type EpsilFamily,
  familyHash,
  isEpsilFamily,
  kernelOn,
  operationsOf,
} from "../collections/src/families/epsil.ts";
import { allFamilies } from "../collections/src/families/index.ts";
import { epsilEntries as compositions } from "../compositions/src/families/core.ts";
import { disagreements } from "../scripts/compile-families.ts";

const ce = new ComputeEngine();
const family = compositions.find((f) => f.head === "CompositionsIntoKParts")!;

function counting(size?: number) {
  const computed: string[] = [];
  const kernel = kernelOn(ce, family, COMPILED_FAMILIES, {
    tablesCacheSize: size,
    onTables: (p, precision) => computed.push(`${precision}:${p.join(",")}`),
  });
  return { kernel, computed };
}

test("a table is computed once per params, however many calls read it", () => {
  const { kernel, computed } = counting();
  for (let r = 0; r < 40; r++) {
    const element = kernel.unrank([12, 4], BigInt(r));
    expect(kernel.valid(element, [12, 4])).toBe(true);
    expect(kernel.rank(element, [12, 4])).toBe(BigInt(r));
  }
  expect(computed).toEqual(["double:12,4"]);
  kernel.unrank([13, 4], 0n);
  expect(computed).toEqual(["double:12,4", "double:13,4"]);
});

test("a walk's tables are one list, computed once per params", () => {
  const walk = allFamilies.filter(isEpsilFamily).find((f) => f.head === "DyckPathsByHeight")!;
  expect(JSON.stringify(walk.epsil.tables)).toContain('"Join"');
  const computed: string[] = [];
  const kernel = kernelOn(ce, walk, COMPILED_FAMILIES, {
    onTables: (p, precision) => computed.push(`${precision}:${p.join(",")}`),
  });
  const total = kernel.count([8, 4]) as bigint;
  for (let r = 0n; r < total; r += 7n) expect(kernel.rank(kernel.unrank([8, 4], r), [8, 4])).toBe(r);
  expect(computed).toEqual(["double:8,4"]);
});

test("a count that doesn't read the table doesn't build it", () => {
  const { kernel, computed } = counting();
  expect(kernel.count([30, 5])).toBe(23751n);
  expect(computed).toEqual([]);
});

test("the cache holds its bound, dropping the least recently used params", () => {
  const { kernel, computed } = counting(2);
  for (const p of [
    [8, 3],
    [9, 3],
    [8, 3],
    [10, 3],
    [8, 3],
    [9, 3],
  ])
    kernel.unrank(p, 0n);
  // 8 is read again after 9 and after 10, so it stays; 9 is evicted by 10 and so recomputed.
  expect(computed).toEqual(["double:8,3", "double:9,3", "double:10,3", "double:9,3"]);
});

test("past 2^53 the interpreter reads an exact table, computed once", () => {
  const { kernel, computed } = counting();
  const p = [60, 25];
  const total = kernel.count(p) as bigint;
  expect(total).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER));
  const ranks = [0n, total / 3n, total - 1n];
  for (const r of ranks) {
    const element = kernel.unrank(p, r);
    expect(kernel.valid(element, p)).toBe(true);
    expect(kernel.rank(element, p)).toBe(r);
  }
  expect(computed.filter((c) => c.startsWith("exact"))).toEqual(["exact:60,25"]);
});

test("the hash changes with the tables", () => {
  const other: EpsilFamily = { ...family, epsil: { ...family.epsil, tables: ["List", 1] } };
  expect(familyHash(other)).not.toBe(familyHash(family));
  expect(familyHash(family)).toBe(COMPILED_FAMILIES.CompositionsIntoKParts.hash);
});

test("every operation of a family with tables is compiled, tables included", () => {
  const tabled = allFamilies.filter(isEpsilFamily).filter((f) => f.epsil.tables !== undefined);
  expect(tabled.map((f) => f.head)).toEqual(
    expect.arrayContaining(["CompositionsIntoKParts", "DelannoyPaths", "DyckPathsByHeight", "PermutationsAsCycles"]),
  );
  for (const { head } of tabled) {
    const entry = COMPILED_FAMILIES[head];
    expect(entry.tables, head).toBeDefined();
    expect(entry.interpreted, head).toBeUndefined();
  }
  expect(operationsOf(family)).toEqual(["count", "unrank", "rank", "valid", "tables"]);
});

test("a compiled table that disagrees with the interpreter is left interpreted", () => {
  const right = { tables: () => [1] };
  expect(disagreements(ce, family, right)).toEqual(["tables"]);
});
