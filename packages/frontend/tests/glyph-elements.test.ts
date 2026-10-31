// The glyph each carrier's elements draw as, on real elements: a few small elements of the first
// collection over each carrier whose glyph needs a nested value or a step encoding, as the engine
// lists them. Golden JSON compared with `toEqual` (AGENTS.md), regenerated with
// `UPDATE_GLYPH_ELEMENTS=1 vp test`.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { CARRIERS, declareCombinatorics } from "@enumeratio/combinatorics";
import { readEntries, recordDirs } from "@enumeratio/entry/node";
import { parseExpression } from "@enumeratio/formats/expression";
import { declareCarrierElement, declareCarrierPlurals, declareStructures } from "@enumeratio/structures";
import type { ReferenceEntry } from "@enumeratio/entry";
import { expect, test } from "vite-plus/test";
import { catalogOf, explorerOf } from "../src/explorer.ts";
import { engineProbes } from "../src/explorer-engine.ts";
import { GLYPH_KINDS } from "../src/glyphs.ts";
import { openRowSource } from "../src/row-source.ts";

const PACKAGES = fileURLToPath(new URL("../../", import.meta.url));
const byName = new Map<string, ReferenceEntry>();
for (const { dir } of recordDirs(PACKAGES))
  for (const e of readEntries(dir)) if (!byName.has(e.name)) byName.set(e.name, e);
const records = [...byName.values()];
const ce = new ComputeEngine();
declareCombinatorics(ce);
declareCarrierPlurals(ce, CARRIERS);
declareCarrierElement(ce, CARRIERS);
declareStructures(ce);
const catalog = { ...catalogOf(records), ...engineProbes(ce) };

/** The carriers whose glyph reads a step encoding or nested lists, not just a flat list of positions. */
const CARRIERS_DRAWN = [
  "DelannoyPath",
  "BinaryTree",
  "FullKAryTree",
  "LukasiewiczPath",
  "MotzkinPath",
  "OrderedTree",
  "SchroederPath",
  "SemistandardTableau",
  "SetComposition",
  "SignedPermutation",
  "StandardTableau",
];
const ELEMENTS = [1, 2, 3];

const GOLDEN = fileURLToPath(new URL("./glyph-elements.golden.json", import.meta.url));
const updating = process.env.UPDATE_GLYPH_ELEMENTS === "1";

async function drawn() {
  const out: Record<string, unknown> = {};
  for (const carrier of CARRIERS_DRAWN) {
    // The first collection over the carrier that opens an explorer.
    let spec;
    for (const collection of records
      .filter((r) => r.grades !== undefined && r.carrier === carrier)
      .toSorted((a, b) => (a.name < b.name ? -1 : 1))) {
      spec = await explorerOf(collection, catalog);
      if (spec !== undefined) break;
    }
    if (spec === undefined) {
      out[carrier] = null;
      continue;
    }
    const { json } = parseExpression(spec.expr);
    const opened = openRowSource(ce, { collection: json, columns: [], glyph: spec.glyph });
    if (!opened.ok) throw new Error(`${spec.expr} does not open`);
    const batch = await opened.source.rows([1n, BigInt(ELEMENTS.length + 1)], [0, 1]);
    out[carrier] = {
      glyph: spec.glyph,
      expr: spec.expr,
      elements: ELEMENTS.map((index, k) => ({
        index,
        element: ce.box(["At", json, index] as never).evaluate().json,
        // The glyph cell is a `TagBox` around the svg text.
        svg: (batch.rows[k]?.[0] as unknown as [string, string, string] | undefined)?.[1],
      })),
    };
  }
  return out;
}

test("each carrier's glyph draws its real elements", async () => {
  const fresh = await drawn();
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
  expect(fresh).toEqual(JSON.parse(readFileSync(GOLDEN, "utf8")));
}, 60_000);

test("every such carrier is drawn, by a glyph kind, in a non-empty picture", async () => {
  const fresh = (await drawn()) as Record<string, { glyph: string; elements: { svg?: string }[] } | null>;
  for (const carrier of CARRIERS_DRAWN) {
    const entry = fresh[carrier];
    expect(entry, carrier).not.toBeNull();
    expect(GLYPH_KINDS.has(entry!.glyph), carrier).toBe(true);
    for (const e of entry!.elements) expect(e.svg, carrier).toMatch(/^<svg /);
  }
}, 60_000);
