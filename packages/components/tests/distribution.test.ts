// Distributions of a statistic over a collection, and the triangle of them over sizes: golden
// JSON compared with `toEqual` (AGENTS.md), regenerated with `UPDATE_DISTRIBUTION=1 vp test`. The
// Mahonian and Eulerian triangles are the textbook ones, so the golden data is also checkable by eye.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { CARRIERS, declareCombinatorics } from "@enumeratio/combinatorics";
import { parseExpression } from "@enumeratio/formats/expression";
import { coefficients, DISTRIBUTION_ROW_CAP, polynomial } from "@enumeratio/frontend/core";
import { declareCarrierElement, declareCarrierPlurals, declareStructures } from "@enumeratio/structures";
import { afterAll, expect, test } from "vite-plus/test";
import { distributionTriangle, equidistributed, tally, type Triangle } from "../src/distribution-client.ts";

const GOLDEN = join(import.meta.dirname, "distribution.golden.json");
const updating = process.env.UPDATE_DISTRIBUTION === "1";
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
declareStructures(ce);

/** The engine as the page's kernel answers: Epsil text in, MathJSON out. */
async function evaluate(text: string): Promise<unknown> {
  const { json, errors } = parseExpression(text);
  if (errors.length > 0) throw new Error(errors.join("; "));
  return ce.box(json as never).evaluate().json;
}

const SIZES = [1, 2, 3, 4, 5];
const triangle = (template: string, statistic: string, maxSize?: number): Promise<Triangle> =>
  distributionTriangle(template, statistic, SIZES, { evaluate, ...(maxSize !== undefined && { maxSize }) });

/** A triangle as rows of coefficients, lowest value first (the Mahonian and Eulerian numbers). */
const rows = (t: Triangle): unknown =>
  t.map((row) =>
    row.ok ? { n: row.n, low: row.distribution.values[0], coefficients: coefficients(row.distribution) } : row,
  );

test("Mahonian numbers: Inversions on the symmetric group", async () => {
  const t = await triangle("SymmetricGroup({size})", "Inversions");
  check("Inversions", rows(t));
  const four = t[3];
  expect(four?.ok && polynomial(four.distribution)).toBe("1 + 3q + 5q^2 + 6q^3 + 5q^4 + 3q^5 + q^6");
});

test("MajorIndex has the Mahonian triangle too", async () => {
  check("MajorIndex", rows(await triangle("SymmetricGroup({size})", "MajorIndex")));
});

test("Eulerian numbers: Descents on the symmetric group", async () => {
  check("Descents", rows(await triangle("SymmetricGroup({size})", "Descents")));
});

test("a partition statistic: LargestPart on the partitions of n", async () => {
  check("LargestPart", rows(await triangle("IntegerPartitions({size})", "LargestPart")));
});

test("equidistribution, both ways, and a pair that is not", async () => {
  const [inversions, majorIndex, descents, excedances] = await Promise.all(
    ["Inversions", "MajorIndex", "Descents", "Excedances"].map((s) => triangle("SymmetricGroup({size})", s)),
  );
  const same = [
    ["Inversions", "MajorIndex", equidistributed(inversions!, majorIndex!), equidistributed(majorIndex!, inversions!)],
    ["Descents", "Excedances", equidistributed(descents!, excedances!), equidistributed(excedances!, descents!)],
  ];
  const different = [
    ["Inversions", "Descents", equidistributed(inversions!, descents!), equidistributed(descents!, inversions!)],
  ];
  check("equidistribution", { same, different });
  for (const [, , ab, ba] of same) expect([ab, ba]).toEqual([true, true]);
  for (const [, , ab, ba] of different) expect([ab, ba]).toEqual([false, false]);
});

test("a size past maxSize declines with a reason, and nothing is computed", async () => {
  let asked = 0;
  const counting = async (text: string): Promise<unknown> => (asked++, evaluate(text));
  const result = await tally("SymmetricGroup(9)", "Inversions", { size: 9, maxSize: 6 }, counting);
  expect(result).toEqual({ ok: false, reason: "a distribution is computed up to size 6; this is size 9" });
  expect(asked).toBe(0);
  const t = await distributionTriangle("SymmetricGroup({size})", "Inversions", [4, 5, 6, 7, 8], {
    evaluate,
    maxSize: 6,
  });
  expect(t.map((row) => [row.n, row.ok])).toEqual([
    [4, true],
    [5, true],
    [6, true],
    [7, false],
  ]);
  check("declined", t.at(-1));
});

test("a collection past the row cap declines without walking it", async () => {
  let walked = false;
  const watching = async (text: string): Promise<unknown> => {
    if (text.startsWith("Tally")) walked = true;
    return evaluate(text);
  };
  const result = await tally("SymmetricGroup(10)", "Inversions", {}, watching);
  expect(result.ok).toBe(false);
  expect(walked).toBe(false);
  expect(DISTRIBUTION_ROW_CAP).toBeLessThan(3_628_800);
});

test("a collection of unknown size is not walked", async () => {
  const result = await tally("NonNegativeIntegers", "Inversions", {}, evaluate);
  expect(result.ok).toBe(false);
});
