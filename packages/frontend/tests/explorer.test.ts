// The explorer each collection record implies: golden JSON compared with `toEqual` (AGENTS.md),
// regenerated with `UPDATE_EXPLORER=1 vp test` after an intended change.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { CARRIERS, declareCombinatorics } from "@enumeratio/combinatorics";
import { readEntries, recordDirs } from "@enumeratio/entry/node";
import { declareCarrierElement, declareCarrierPlurals, declareStructures } from "@enumeratio/structures";
import type { ReferenceEntry } from "@enumeratio/entry";
import { expect, test } from "vite-plus/test";
import { parseExpression } from "@enumeratio/formats/expression";
import { splitColumns } from "../src/collection-table.ts";
import { catalogOf, DEFAULT_COLUMNS, explorerOf } from "../src/explorer.ts";
import { openRowSource } from "../src/row-source.ts";
import { engineProbes } from "../src/explorer-engine.ts";
import { GLYPH_KINDS } from "../src/glyphs.ts";
import { exprAt, HEAD_GLYPHS, templateOfExpr } from "../src/table-state.ts";
import { glyphTable } from "../scripts/glyph-table.ts";
import { tryItOf, tryItOfExplorer, withExplorerSize } from "../src/try-it.ts";

const PACKAGES = fileURLToPath(new URL("../../", import.meta.url));
// A head two packages document is one record: the first wins, as the site's loader has it.
const byName = new Map<string, ReferenceEntry>();
for (const { dir } of recordDirs(PACKAGES))
  for (const e of readEntries(dir)) if (!byName.has(e.name)) byName.set(e.name, e);
const records = [...byName.values()];
const ce = new ComputeEngine();
declareCombinatorics(ce);
declareCarrierPlurals(ce, CARRIERS);
declareCarrierElement(ce, CARRIERS);
declareStructures(ce);
// Probed as the site's build probes: an expression that does not open, or a statistic that does
// not answer on the first row, is left out.
const catalog = { ...catalogOf(records), ...engineProbes(ce) };
const collections = records.filter((r) => r.grades !== undefined).toSorted((a, b) => (a.name < b.name ? -1 : 1));

const specs = new Map(await Promise.all(collections.map(async (r) => [r.name, await explorerOf(r, catalog)] as const)));

const GOLDEN = fileURLToPath(new URL("./explorer.golden.json", import.meta.url));
const updating = process.env.UPDATE_EXPLORER === "1";

test("the explorer of each collection record", () => {
  const fresh = Object.fromEntries(
    collections.map((r) => {
      const spec = specs.get(r.name);
      return [
        r.name,
        spec === undefined
          ? null
          : {
              expr: spec.expr,
              ...(spec.template !== undefined && { template: spec.template }),
              ...(spec.size !== undefined && { size: spec.size }),
              ...(spec.glyph !== undefined && { glyph: spec.glyph }),
              columns: spec.columns,
              derived: spec.derived,
              statistics: spec.candidates.length,
            },
      ];
    }),
  );
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
  expect(fresh).toEqual(JSON.parse(readFileSync(GOLDEN, "utf8")));
});

test("every glyph a carrier record or an explorer names is a glyph kind", () => {
  for (const r of records.filter((r) => r.catalogCarrier && r.glyph !== undefined))
    expect(GLYPH_KINDS.has(r.glyph!), `${r.name}: ${r.glyph}`).toBe(true);
  for (const [name, spec] of specs)
    if (spec?.glyph !== undefined) expect(GLYPH_KINDS.has(spec.glyph), `${name}: ${spec.glyph}`).toBe(true);
});

test("the size never goes past the record's maxSize", () => {
  for (const r of collections) {
    const size = specs.get(r.name)?.size;
    if (size === undefined) continue;
    expect(size.min, r.name).toBeLessThanOrEqual(size.start);
    expect(size.start, r.name).toBeLessThanOrEqual(size.max);
    if (r.maxSize !== undefined) expect(size.max, r.name).toBeLessThanOrEqual(r.maxSize);
  }
});

test("a derived table's columns are statistics on its carrier, few", () => {
  for (const r of collections) {
    const spec = specs.get(r.name);
    if (spec === undefined || r.enumerate?.columns !== undefined) continue;
    expect(spec.columns.length, r.name).toBeLessThanOrEqual(DEFAULT_COLUMNS);
    const names = new Set(spec.candidates.map((c) => c.name));
    for (const c of spec.columns) expect(names.has(c), `${r.name}: ${c}`).toBe(true);
  }
});

test("an explicit enumerate: wins, field by field", () => {
  const explicit = collections.filter((r) => r.enumerate !== undefined);
  expect(explicit.length).toBeGreaterThan(0);
  for (const r of explicit) {
    const spec = specs.get(r.name)!;
    const e = r.enumerate!;
    expect(spec.expr, r.name).toBe(e.expr);
    expect(spec.size, r.name).toBeUndefined();
    if (e.columns !== undefined) expect(spec.columns, r.name).toEqual(splitColumns(e.columns));
    if (e.glyph !== undefined) expect(spec.glyph, r.name).toBe(e.glyph);
    expect(spec.pageSize, r.name).toBe(e.pageSize ?? 10);
  }
});

test("a record without enumerate: gains its table where its call can be told", () => {
  const derived = collections.filter((r) => r.enumerate === undefined);
  const gained = derived.filter((r) => specs.get(r.name) !== undefined);
  expect(gained.length).toBeGreaterThan(derived.length / 2);
});

test("a derived glyph draws the first row", async () => {
  const problems: string[] = [];
  for (const r of collections.filter((r) => r.enumerate === undefined)) {
    const spec = specs.get(r.name);
    if (spec?.glyph === undefined) continue;
    const { json } = parseExpression(spec.expr);
    const opened = openRowSource(ce, { collection: json, columns: [], glyph: spec.glyph });
    const batch = opened.ok ? await opened.source.rows([1n, 2n], [0, 1]) : undefined;
    if (batch?.rows[0]?.[0] === undefined || batch.rows[0][0] === "") problems.push(`${r.name}: ${spec.glyph}`);
  }
  expect(problems).toEqual([]);
});

test("the built head-to-glyph table is the carriers' records", () => {
  expect(HEAD_GLYPHS).toEqual(glyphTable(records));
  for (const kind of Object.values(HEAD_GLYPHS)) expect(GLYPH_KINDS.has(kind), kind).toBe(true);
});

test("a size stepper rewrites only a call with one integer", () => {
  expect(templateOfExpr("Derangements(4)")).toBe("Derangements({size})");
  expect(templateOfExpr("Permutations")).toBeUndefined();
  expect(templateOfExpr("Subsets(4, 2)")).toBeUndefined();
  expect(exprAt("Derangements({size})", 5)).toBe("Derangements(5)");
});

test("a derived column varies over the collection it opens on", async () => {
  // FixedPoints is 0 on every derangement; Inversions is not.
  expect(await catalog.varies("Derangements(4)", "FixedPoints")).toBe(false);
  expect(await catalog.varies("Derangements(4)", "Inversions")).toBe(true);
  for (const spec of specs.values()) {
    if (spec?.derived !== true) continue;
    for (const column of spec.columns) expect(await catalog.varies(spec.expr, column), spec.expr).toBe(true);
  }
});

// Try it's fallback panel for each derived explorer: golden JSON too.
const TRY_IT_GOLDEN = fileURLToPath(new URL("./try-it-explorer.golden.json", import.meta.url));

test("a derived explorer without a liftable example still gets a Try it, bounded as the stepper is", () => {
  const record = byName.get("Derangements")!;
  expect(record.enumerate).toBeUndefined();
  const spec = specs.get("Derangements")!;
  // No typed parameter, so no example lifts; the explorer's sized call stands in.
  const bare = { head: "Derangements", parameters: [] };
  for (const ex of record.examples) expect(tryItOf(ex.expr as never, bare)).toBeUndefined();
  const { start, min, max } = spec.size!;
  expect(tryItOfExplorer(spec)).toEqual({
    params: `{{size, ${start}}, ${min}, ${max}, 1, Slider}`,
    value: "Derangements(_size)",
  });
});

test("Try it's panels follow the explorer's size for every derived explorer", () => {
  const fresh: Record<string, unknown> = {};
  for (const [name, spec] of specs) {
    const panel = tryItOfExplorer(spec);
    if (spec?.size === undefined) {
      expect(panel, name).toBeUndefined();
      continue;
    }
    const { min, max, start } = spec.size;
    expect(panel?.params, name).toMatch(/, Slider\}$/);
    expect(panel?.params.includes(`, ${start}}, ${min}, ${max}, 1,`), name).toBe(true);
    fresh[name] = panel;
  }
  if (updating) writeFileSync(TRY_IT_GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
  expect(fresh).toEqual(JSON.parse(readFileSync(TRY_IT_GOLDEN, "utf8")));
});

test("a lifted example's size control takes the stepper's bounds, start clamped into them", () => {
  const spec = specs.get("Derangements")!;
  const signature = withExplorerSize({ head: "Derangements", parameters: [{ name: "n", type: "integer" }] }, spec);
  const { min, max } = spec.size!;
  const paramsOf = (src: string) => tryItOf(parseExpression(src).json, signature)?.params;
  expect(paramsOf("Derangements(3)")).toBe(`{{n, 3}, ${min}, ${max}, 1, Slider}`);
  expect(paramsOf("Derangements(99)")).toBe(`{{n, ${max}}, ${min}, ${max}, 1, Slider}`);
});
