// DeleteFromTableau against an independent row insertion: peeling an RSK pair cell by cell from
// the recording tableau leaves the insertion tableaux of the word's prefixes, and what it drops
// is the letters read backwards. Plus Combinatorica's own values and the domain it declines.

import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { CARRIERS, declareCombinatorics, declareMaps } from "../src/index.ts";
import { permutations } from "./maps-helpers.ts";

const ce = bareEngine();
declareCombinatorics(ce);
declareMaps(ce, Object.fromEntries(CARRIERS.map((c) => [c.type, c.name])));

const value = (expr: unknown): unknown => ce.box(expr as never).evaluate().json;
const list = (rows: number[][]): unknown => ["List", ...rows.map((r) => ["List", ...r])];
const deleted = (rows: number[][], r: number): unknown => value(["DeleteFromTableau", list(rows), r]);

/** Schensted row insertion of the word's letters, each bumping the smallest larger entry. */
function insertAll(word: readonly number[]): number[][] {
  const rows: number[][] = [];
  for (let x of word) {
    for (let i = 0; ; i++) {
      if (i === rows.length) {
        rows.push([x]);
        break;
      }
      const k = rows[i]!.findIndex((y) => y > x);
      if (k < 0) {
        rows[i]!.push(x);
        break;
      }
      [rows[i]![k], x] = [x, rows[i]![k]!];
    }
  }
  return rows;
}

/** The rows of an evaluated `List` of `List`s of integers. */
const rowsOf = (tableau: unknown): number[][] => (tableau as unknown[]).slice(1).map((r) => (r as number[]).slice(1));

/** The two tableaux inside an evaluated `Rsk` pair, wherever its wrappers put them. */
function tableauxIn(node: unknown, found: number[][][] = []): number[][][] {
  if (!Array.isArray(node)) return found;
  const isRows =
    node[0] === "List" &&
    node.length > 1 &&
    node.slice(1).every((r) => Array.isArray(r) && r[0] === "List" && r.slice(1).every(Number.isInteger));
  if (isRows) found.push(rowsOf(node));
  else node.forEach((child) => tableauxIn(child, found));
  return found;
}

test("Combinatorica's values", () => {
  const t = [[1, 2, 5], [3, 4], [6]];
  expect(deleted(t, 3)).toEqual(
    list([
      [1, 4, 5],
      [3, 6],
    ]),
  );
  expect(deleted(t, 2)).toEqual(list([[1, 4, 5], [3], [6]]));
  expect(deleted(t, 1)).toEqual(list([[1, 2], [3, 4], [6]]));
  expect(deleted([[1, 3], [2]], 2)).toEqual(list([[2, 3]]));
  expect(deleted([[1, 5], [3, 6], [4]], 3)).toEqual(
    list([
      [3, 5],
      [4, 6],
    ]),
  );
  expect(deleted([[1]], 1)).toEqual(["List"]);
});

test("peeling an RSK pair undoes the insertions, up to n = 4 (5 under DEEP_TESTS)", { timeout: 120_000 }, () => {
  const words = [1, 2, 3, 4, ...(process.env.DEEP_TESTS === "1" ? [5] : [])].flatMap(permutations);
  for (const word of words) {
    const [pRows, qRows] = tableauxIn(value(["Rsk", ["Permutation", ["List", ...word]]]));
    let p = pRows!;
    let q = qRows!;
    for (let k = word.length; k >= 1; k--) {
      const r = q.findIndex((row) => row[row.length - 1] === k) + 1;
      expect(r, `[${word.join(",")}] cell ${k}`).toBeGreaterThan(0);
      const before = p.flat();
      p = rowsOf(deleted(p, r));
      q = q.map((row) => row.filter((x) => x !== k)).filter((row) => row.length > 0);
      expect(p, `[${word.join(",")}] after ${k}`).toEqual(insertAll(word.slice(0, k - 1)));
      // The dropped entry is the letter: the one entry the tableau no longer holds.
      expect(
        before.filter((x) => !p.flat().includes(x)),
        `[${word.join(",")}] letter ${k}`,
      ).toEqual([word[k - 1]]);
    }
  }
});

test("a semistandard tableau reverse bumps with repeats", () => {
  expect(deleted([[1, 1, 2], [2]], 2)).toEqual(list([[1, 2, 2]]));
});

test("outside its domain it stays unevaluated", () => {
  const stays = (rows: unknown, r: unknown): void =>
    expect(value(["DeleteFromTableau", rows, r])).toEqual(["DeleteFromTableau", rows, r]);
  stays(
    list([
      [1, 2],
      [3, 4],
    ]),
    1,
  ); // row 1 does not end in a corner
  stays(
    list([
      [1, 2],
      [3, 4],
    ]),
    3,
  ); // no such row
  stays(
    list([
      [1, 2],
      [3, 4],
    ]),
    0,
  );
  stays(list([[2, 1], [3]]), 2); // a row decreases
  stays(list([[1, 2], [1]]), 2); // a column does not increase
  stays(list([[1], [2, 3]]), 2); // not a partition shape
  stays(["List"], 1);
});
