// Every `statOn` a record claims must be answerable: the explorer and the statistic pages trust
// it. A statistic on a carrier has to evaluate on an element of some small collection of that carrier.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { CARRIERS, declareCombinatorics } from "@enumeratio/combinatorics";
import { readEntries, recordDirs } from "@enumeratio/entry/node";
import { declareCarrierElement, declareCarrierPlurals, declareStructures } from "@enumeratio/structures";
import type { ReferenceEntry } from "@enumeratio/entry";
import { expect, test } from "vite-plus/test";
import { catalogOf, explorerOf } from "../src/explorer.ts";
import { parseExpression } from "@enumeratio/formats/expression";
import { toText } from "@enumeratio/boxes/render";
import { engineProbes } from "../src/explorer-engine.ts";
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
const probes = engineProbes(ce);
const catalog = { ...catalogOf(records), ...probes };

// Small collections per carrier: those the explorer opens at their start size.
const collectionsOf = new Map<string, string[]>();
for (const r of records.filter((r) => r.grades !== undefined && r.carrier !== undefined)) {
  const spec = await explorerOf(r, catalog);
  if (spec === undefined) continue;
  collectionsOf.set(r.carrier!, [...(collectionsOf.get(r.carrier!) ?? []), spec.expr]);
}

// A carrier no collection record opens: its plural at small, plain arguments.
for (const c of CARRIERS)
  if (c.plural !== undefined && !collectionsOf.has(c.name))
    for (const args of ["3", "4", "3, 2", "4, 2", "3, 2, 2"]) {
      const expr = `${c.plural}(${args})`;
      if ((await probes.opens(expr)) === true) collectionsOf.set(c.name, [...(collectionsOf.get(c.name) ?? []), expr]);
    }

// What a statistic's page asks: `CombinatorialStat` on a row of the collection, which is stricter
// than the bare head applied to it (`Length(partition)` is the list's length, not a statistic).
// The row is a bare list in the table, so it is wrapped in the carrier as a typed statistic expects.
async function answers(collection: string, carrier: string, statistic: string): Promise<boolean> {
  const { json, errors } = parseExpression(collection);
  if (errors.length > 0) return false;
  try {
    const opened = openRowSource(ce, {
      collection: json,
      columns: [`CombinatorialStat(${carrier}(_), "${statistic}")`],
    });
    if (opened.ok) {
      const batch = await opened.source.rows([1n, 2n], [0, opened.source.columns.length]);
      const cell = batch.rows[0]?.at(-1);
      const text = cell === undefined ? "" : toText(cell);
      if (text !== "" && text !== "⚠" && !text.startsWith("CombinatorialStat")) return true;
    }
  } catch {
    // Fall through to the collection form.
  }
  // A carrier that packs parameters ahead of its elements (a subset of 1..n) has no bare row to
  // wrap; its statistic's page asks the collection itself.
  try {
    const value = ce.box(["At", ["CombinatorialStat", json, `'${statistic}'`], 2] as never).evaluate().json;
    return !Array.isArray(value) || !["At", "CombinatorialStat", "Error"].includes(String(value[0]));
  } catch {
    return false;
  }
}

// The claims that do not answer yet are the golden: a new one, or a fixed one, changes it.
// Regenerate with `UPDATE_STAT_ON=1 vp test`. `unanswered` are statistics `CombinatorialStat` cannot
// compute on any small collection of the carrier; `untested` are carriers no collection opens here.
const GOLDEN = fileURLToPath(new URL("./stat-on.golden.json", import.meta.url));

test("every statOn claim answers on its carrier, or is a known gap", async () => {
  const unanswered: string[] = [];
  const untested: string[] = [];
  for (const r of records.filter((r) => r.statOn !== undefined))
    for (const carrier of r.statOn!) {
      const exprs = collectionsOf.get(carrier) ?? [];
      if (exprs.length === 0) {
        untested.push(`${r.name} on ${carrier}`);
        continue;
      }
      let answered = false;
      for (const expr of exprs) if ((answered = await answers(expr, carrier, r.name))) break;
      if (!answered) unanswered.push(`${r.name} on ${carrier}`);
    }
  const fresh = { unanswered: unanswered.toSorted(), untested: untested.toSorted() };
  if (process.env.UPDATE_STAT_ON === "1") writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
  expect(fresh).toEqual(JSON.parse(readFileSync(GOLDEN, "utf8")));
}, 60_000);
