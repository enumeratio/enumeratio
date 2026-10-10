// BoxedPlanePartitions defined in Epsil: against the order the TS kernel listed (a frozen record, dumped
// from it before it was replaced), an independent predicate for membership, and MacMahon's formula in bigint.

import { readFileSync } from "node:fs";
import { collectMessages } from "@enumeratio/engine";
import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { epsilKernelOn } from "../../collections/src/families/epsil.ts";
import { declareCombinatorics } from "../../src/index.ts";
import { boxedPlanePartitions } from "../src/families/boxed-plane-partitions.ts";

const DEEP = process.env.DEEP_TESTS === "1";
const kernel = epsilKernelOn(bareEngine(), boxedPlanePartitions);

// A frozen record of the order the family had as a TS kernel (rows as comma lists, joined by /), for the
// boxes of up to 9 cells and a few larger. It is not regenerated: the Epsil must list the partitions in it.
const OLD = JSON.parse(
  readFileSync(new URL("./golden/old-boxed-plane-partitions.json", import.meta.url), "utf8"),
) as Record<string, string[]>;
const parse = (text: string): number[][] =>
  text === "" ? [] : text.split("/").map((row) => row.split(",").map(Number));
const written = (element: unknown): string => (element as number[][]).map((row) => row.join(",")).join("/");

test("every box lists its plane partitions in the order the TS kernel did, and rank and unrank invert", () => {
  const boxes = Object.keys(OLD);
  expect(boxes.length).toBeGreaterThan(60);
  expect(boxes).toContain("2,4,3");
  expect(boxes).toContain("4,4,2");
  expect(boxes).toContain("3,3,3");
  for (const box of boxes) {
    const p = box.split(",").map(Number);
    expect([box, kernel.count(p)]).toEqual([box, BigInt(OLD[box].length)]);
    OLD[box].forEach((text, r) => {
      const member = parse(text);
      expect([box, r, written(kernel.unrank(p, BigInt(r)))]).toEqual([box, r, text]);
      expect([box, r, kernel.rank(member, p)]).toEqual([box, r, BigInt(r)]);
      expect([box, text, kernel.valid(member, p)]).toEqual([box, text, true]);
    });
  }
});

/** Whether `rows` fits the a × b × c box, written independently of the family: a dense a × b grid of
 *  heights 0..c, weakly falling along rows and columns, whose nonzero part is `rows`. */
function inBox(rows: number[][], a: number, b: number, c: number): boolean {
  if (rows.length > a) return false;
  const height = (i: number, j: number): number => rows[i]?.[j] ?? 0;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].length === 0 || rows[i].length > b) return false;
    for (let j = 0; j < rows[i].length; j++) {
      const h = rows[i][j];
      if (!Number.isInteger(h) || h < 1 || h > c) return false;
    }
  }
  for (let i = 0; i < a; i++)
    for (let j = 0; j < b; j++) {
      if (j > 0 && height(i, j) > height(i, j - 1)) return false;
      if (i > 0 && height(i, j) > height(i - 1, j)) return false;
    }
  return true;
}

/** Every list of at most `rows` lists of at most `cols` entries of 0..top. */
function lists(rows: number, cols: number, top: number): number[][][] {
  const cells = (len: number): number[][] =>
    len === 0 ? [[]] : cells(len - 1).flatMap((row) => Array.from({ length: top + 1 }, (_, v) => [...row, v]));
  const oneRow = Array.from({ length: cols + 1 }, (_, len) => cells(len)).flat();
  const grow = (count: number): number[][][] =>
    count === 0 ? [[]] : grow(count - 1).flatMap((rest) => oneRow.map((row) => [...rest, row]));
  return Array.from({ length: rows + 1 }, (_, count) => grow(count)).flat();
}

test("membership over every list of rows near the box, rows empty, rows too long, entries 0 or above c", () => {
  let rejected = 0;
  // DEEP_TESTS=1 adds the box (2, 2, 2), 20 seconds more.
  const boxes = [[2, 1, 2], [1, 2, 3], [2, 2, 1], [1, 1, 1], ...(DEEP ? [[2, 2, 2]] : [])];
  for (const p of boxes) {
    const [a, b, c] = p;
    for (const candidate of lists(a + 1, b + 1, c + 1).filter((rows) => rows.length <= a + 1)) {
      const want = inBox(candidate, a, b, c);
      expect([p, candidate, kernel.valid(candidate, p)]).toEqual([p, candidate, want]);
      if (!want) rejected++;
    }
  }
  expect(rejected).toBeGreaterThan(1000);
  // An empty side leaves the empty plane partition alone.
  for (const p of [
    [0, 3, 3],
    [3, 0, 3],
    [3, 3, 0],
  ]) {
    expect(kernel.valid([], p)).toBe(true);
    expect(kernel.valid([[1]], p)).toBe(false);
    expect(kernel.count(p)).toBe(1n);
    expect(kernel.unrank(p, 0n)).toEqual([]);
    expect(kernel.rank([], p)).toBe(0n);
  }
});

/** MacMahon's box formula, Π (i + j + k − 1)/(i + j + k − 2), in bigint, one division at the end. */
function macMahon(a: number, b: number, c: number): bigint {
  let num = 1n;
  let den = 1n;
  for (let i = 1; i <= a; i++)
    for (let j = 1; j <= b; j++)
      for (let k = 1; k <= c; k++) {
        num *= BigInt(i + j + k - 1);
        den *= BigInt(i + j + k - 2);
      }
  return num / den;
}

test("the counts are MacMahon's, exact, also where no enumeration reaches", () => {
  for (const p of [
    [2, 2, 2],
    [3, 3, 3],
    [5, 5, 5],
    [6, 6, 6],
    [1, 9, 4],
    [4, 1, 9],
    [7, 7, 7],
    [10, 10, 10],
    [8, 3, 12],
    [20, 20, 20],
    [0, 4, 4],
    [4, 0, 4],
    [4, 4, 0],
  ])
    expect([p, kernel.count(p)]).toEqual([p, macMahon(p[0], p[1], p[2])]);
  expect(kernel.count([5, 5, 5])).toBe(267227532n);
});

test("past 2^53 unrank and rank decline, and membership still answers", () => {
  expect(() => kernel.unrank([7, 7, 7], 0n)).toThrow(RangeError);
  expect(() => kernel.rank([[1]], [7, 7, 7])).toThrow(RangeError);
  expect(kernel.valid([[7, 7, 7], [7]], [7, 7, 7])).toBe(true);
  expect(kernel.valid([[8]], [7, 7, 7])).toBe(false);
});

test("the first, middle and last partitions of large fibers round-trip", () => {
  for (const p of [
    [4, 4, 4],
    [5, 5, 5],
    [3, 6, 5],
    [6, 3, 5],
    [2, 6, 6],
  ]) {
    const total = kernel.count(p) as bigint;
    for (const r of [0n, 1n, total / 3n, total / 2n, total - 2n, total - 1n]) {
      const element = kernel.unrank(p, r);
      expect([p, r, kernel.valid(element, p)]).toEqual([p, r, true]);
      expect([p, r, kernel.rank(element, p)]).toEqual([p, r, r]);
    }
    // The first partition is empty and the last fills the box.
    expect(kernel.unrank(p, 0n)).toEqual([]);
    expect(kernel.unrank(p, total - 1n)).toEqual(
      Array.from({ length: p[0] }, () => Array.from({ length: p[1] }, () => p[2])),
    );
  }
  expect(() => kernel.unrank([3, 3, 3], 980n)).toThrow(RangeError);
});

test("through the engine: At answers where the old kernel declined, and Element asks membership", () => {
  const engine = bareEngine();
  declareCombinatorics(engine);
  const run = (expr: unknown) => engine.box(expr as never).evaluate().json;
  expect(run(["At", ["BoxedPlanePartitions", 5, 5, 5], 267227532])).toEqual([
    "List",
    ...Array.from({ length: 5 }, () => ["List", 5, 5, 5, 5, 5]),
  ]);
  const element = (rows: unknown, box: number[]) => run(["Element", rows, ["BoxedPlanePartitions", ...box]]);
  expect(element(["List", ["List", 2, 1], ["List", 1]], [2, 2, 2])).toBe("True");
  expect(element(["List", ["List", 1, 1], ["List", 2]], [2, 2, 2])).toBe("False");
  expect(element(["List", ["List", 3]], [2, 2, 2])).toBe("False");
  expect(element(["List", ["List", 1], ["List", 1], ["List", 1]], [2, 2, 2])).toBe("False");
  expect(element(["List", ["List", 1, 1, 1]], [2, 2, 2])).toBe("False");
});

test("a thin, tall box has few partitions but many rows: a call is refused for its steps, at once", () => {
  const engine = bareEngine();
  declareCombinatorics(engine);
  const run = (expr: unknown) => {
    const { value, messages } = collectMessages(engine, () => engine.box(expr as never).evaluate());
    return { json: value.json, texts: messages.map((m) => (m as { text?: string }).text ?? "") };
  };
  const started = Date.now();
  for (const box of [
    [1, 100, 2],
    [1, 1000, 1],
    [2, 30, 3],
  ]) {
    const call = ["At", ["BoxedPlanePartitions", ...box], 1];
    const { json, texts } = run(call);
    expect(Array.isArray(json) && json[0] === "List", JSON.stringify(call)).toBe(false);
    expect(texts.join(" ")).toMatch(/would take about [\d,]+ steps; the limit is 2,000,000/);
  }
  expect(Date.now() - started).toBeLessThan(2000);
  // The count is a formula and needs no table: 5151 plane partitions in the 1 × 100 × 2 box.
  expect(run(["Count", ["BoxedPlanePartitions", 1, 100, 2]]).json).toBe(5151);
});
