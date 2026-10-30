// Statistic transport along a map, with the real engine at small sizes: golden JSON compared
// with `toEqual` (AGENTS.md), regenerated with `UPDATE_TRANSPORT=1 vp test`. The transports are
// textbook ones -- Foata's bijection sends the major index to the inversion number, reversal sends
// descents to ascents -- so the golden data is checkable by eye.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { CARRIERS, declareCombinatorics, declareMaps } from "@enumeratio/combinatorics";
import { parseExpression } from "@enumeratio/formats/expression";
import { coefficients, type Triangle } from "@enumeratio/frontend/core";
import { declareCarrierElement, declareCarrierPlurals, declareStructures } from "@enumeratio/structures";
import { afterAll, expect, test, vi } from "vite-plus/test";
import { distributionTriangle } from "../src/distribution-client.ts";
import type { MapSource } from "../src/map-client.ts";
import { findTransports, transportTriangle } from "../src/transport-client.ts";

// These run the real engine over whole collections; a loaded CI runner is several times slower than a laptop.
vi.setConfig({ testTimeout: 60_000 });

const GOLDEN = join(import.meta.dirname, "transport.golden.json");
const updating = process.env.UPDATE_TRANSPORT === "1";
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
const permutations = (name: string): MapSource => ({
  name,
  template: "SymmetricGroup({size})",
  maxSize: 7,
  selfMap: true,
});

/** A triangle as rows of coefficients, lowest value first. */
const rows = (t: Triangle): unknown =>
  t.map((row) =>
    row.ok ? { n: row.n, low: row.distribution.values[0], coefficients: coefficients(row.distribution) } : row,
  );

const STATISTICS = ["Inversions", "MajorIndex", "Descents", "Ascents", "Excedances"];

test("Foata's map sends the major index to the inversion number", async () => {
  const map = permutations("Foata");
  const subject = await transportTriangle(map, "Inversions", SIZES, { evaluate });
  // inv(Foata(w)) = maj(w): the image's inversions are distributed as the source's major index.
  const found = await findTransports(map, subject, STATISTICS, { evaluate });
  check("Foata Inversions", { triangle: rows(subject), found });
  expect(found.matches).toContain("MajorIndex");
  expect(found.matches).toContain("Inversions");
  expect(found.matches).not.toContain("Descents");
});

test("reversal sends descents to ascents, and not to the inversion number", async () => {
  const map = permutations("Reverse");
  const subject = await transportTriangle(map, "Descents", SIZES, { evaluate });
  const found = await findTransports(map, subject, STATISTICS, { evaluate });
  check("Reverse Descents", { triangle: rows(subject), found });
  expect(found.matches).toContain("Ascents");
  expect(found.matches).not.toContain("Inversions");
});

test("the transported distribution is the source's own when the map preserves the statistic", async () => {
  const map = permutations("Inverse");
  const subject = await transportTriangle(map, "Inversions", SIZES, { evaluate });
  const source = await distributionTriangle(map.template, "Inversions", SIZES, { evaluate });
  expect(rows(subject)).toEqual(rows(source));
});

test("a size past the map's bound declines, and the triangle stops there", async () => {
  const map: MapSource = { ...permutations("Reverse"), maxSize: 3 };
  const subject = await transportTriangle(map, "Descents", SIZES, { evaluate });
  check("bound", rows(subject));
  expect(subject.map((r) => r.ok)).toEqual([true, true, true, false]);
});

test("a map over more elements than the cap declines before tallying", async () => {
  const subject = await transportTriangle(permutations("Reverse"), "Descents", [8], { evaluate });
  expect(subject[0]?.ok).toBe(false);
});

test("the scan reports progress in both phases, and stops when the budget is spent", async () => {
  const map = permutations("Reverse");
  const subject = await transportTriangle(map, "Descents", [1, 2, 3, 4, 5, 6], { evaluate });
  const seen: string[] = [];
  const full = await findTransports(map, subject, STATISTICS, {
    evaluate,
    progress: (checked, total, phase) => seen.push(`${phase} ${checked}/${total}`),
  });
  expect(seen[0]).toBe(`screen ${STATISTICS.length}/${STATISTICS.length}`);
  expect(seen.some((s) => s.startsWith("confirm"))).toBe(true);
  expect(full.stopped).toBe(false);
  let tick = 0;
  const cut = await findTransports(map, subject, STATISTICS, { evaluate, budgetMs: 0, now: () => tick++ });
  expect(cut.stopped).toBe(true);
  expect(cut.matches).toEqual([]);
});

test("too few sizes say nothing", async () => {
  const map = permutations("Reverse");
  const subject = await transportTriangle(map, "Descents", [1, 2], { evaluate });
  const found = await findTransports(map, subject, STATISTICS, { evaluate });
  expect(found).toEqual({ matches: [], unconfirmed: [], checked: 0, total: STATISTICS.length, stopped: false });
});
