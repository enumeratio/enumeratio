// AlternatingSignMatrices defined in Epsil: row by row, entries −1, 0, 1, against matrices filtered
// from every sign matrix and a generator that checks the sums as it goes, and its count against the
// product formula and the known numbers.

import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { epsilKernelOn } from "../../collections/src/families/epsil.ts";
import { declareCombinatorics } from "../../src/index.ts";
import { alternatingSignMatrices } from "../src/families/alternating-sign-matrices.ts";

const kernel = epsilKernelOn(bareEngine(), alternatingSignMatrices);

/** Whether every prefix sum of `entries` is 0 or 1 and the total is 1. */
const alternates = (entries: number[]): boolean => {
  let sum = 0;
  for (const x of entries) {
    sum += x;
    if (sum < 0 || sum > 1) return false;
  }
  return sum === 1;
};

const isAlternatingSign = (m: number[][]): boolean =>
  m.length === 0 || (m.every(alternates) && m[0].every((_, j) => alternates(m.map((row) => row[j]))));

/** Every n × n matrix of −1, 0, 1 in row-major lex order, filtered. */
function filtered(n: number): number[][][] {
  const out: number[][][] = [];
  const cells = n * n;
  for (let code = 0; code < 3 ** cells; code++) {
    const entries = Array.from({ length: cells }, (_, i) => (Math.floor(code / 3 ** (cells - 1 - i)) % 3) - 1);
    const m = Array.from({ length: n }, (_, i) => entries.slice(i * n, (i + 1) * n));
    if (isAlternatingSign(m)) out.push(m);
  }
  return out;
}

/** The same, grown row by row with the column sums checked as the rows go in. */
function grown(n: number): number[][][] {
  const out: number[][][] = [];
  const rowsFrom = (columns: number[]): number[][] => {
    const rows: number[][] = [];
    const build = (row: number[], sum: number): void => {
      const c = row.length;
      if (c === n) {
        if (sum === 1) rows.push(row);
        return;
      }
      for (const v of [-1, 0, 1]) {
        const column = columns[c] + v;
        if (column >= 0 && column <= 1 && sum + v >= 0 && sum + v <= 1) build([...row, v], sum + v);
      }
    };
    build([], 0);
    return rows;
  };
  const walk = (rows: number[][], columns: number[]): void => {
    if (rows.length === n) {
      out.push(rows);
      return;
    }
    for (const row of rowsFrom(columns))
      walk(
        [...rows, row],
        columns.map((x, j) => x + row[j]),
      );
  };
  walk([], Array(n).fill(0));
  return out;
}

for (const n of [0, 1, 2, 3]) {
  test(`AlternatingSignMatrices(${n}) is every alternating sign matrix, in row-major lex order`, () => {
    const expected = filtered(n);
    expect(kernel.count([n])).toBe(BigInt(expected.length));
    expected.forEach((m, r) => {
      expect(kernel.unrank([n], BigInt(r))).toEqual(m);
      expect(kernel.rank(m, [n])).toBe(BigInt(r));
    });
  });
}

for (const n of [4, 5]) {
  test(`AlternatingSignMatrices(${n}) is every matrix grown row by row`, () => {
    const expected = grown(n);
    expect(kernel.count([n])).toBe(BigInt(expected.length));
    for (let r = 0; r < expected.length; r += n === 4 ? 1 : 3) {
      expect(kernel.unrank([n], BigInt(r))).toEqual(expected[r]);
      expect(kernel.rank(expected[r], [n])).toBe(BigInt(r));
    }
  });
}

test("membership over every sign matrix near the family", () => {
  const members = filtered(3);
  const known = new Set(members.map((m) => JSON.stringify(m)));
  const tried: number[][][] = [...filtered(2), ...members, ...grown(4).slice(0, 5)];
  for (const m of members)
    for (const [i, j] of [
      [0, 0],
      [1, 1],
      [2, 2],
      [0, 2],
      [2, 0],
    ])
      for (const delta of [-1, 1])
        tried.push(m.map((row, a) => row.map((x, b) => (a === i && b === j ? x + delta : x))));
  tried.push(
    [],
    [[1, 0, 0]],
    [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [0, 0, 0],
    ],
    [
      [1, 0],
      [0, 1],
      [0, 0],
    ],
  );
  expect(tried.filter((m) => !known.has(JSON.stringify(m))).length).toBeGreaterThan(40);
  for (const m of tried) expect([m, kernel.valid(m, [3])]).toEqual([m, known.has(JSON.stringify(m))]);
});

test("1, 2, 7, 42, 429, … and the product formula, exactly, at sizes no enumeration reaches", () => {
  expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => kernel.count([n]))).toEqual(
    [1, 1, 2, 7, 42, 429, 7436, 218348, 10850216, 911835460].map(BigInt),
  );
  expect(kernel.count([20])).toBe(1436038934715538200913155682637051204376827212n);
  expect(() => kernel.unrank([12], 0n)).toThrow(RangeError);
});

test("a matrix of an order no enumeration reaches round-trips", () => {
  const m = kernel.unrank([9], 123456789n);
  expect(isAlternatingSign(m as number[][])).toBe(true);
  expect(kernel.valid(m, [9])).toBe(true);
  expect(kernel.rank(m, [9])).toBe(123456789n);
});

test("through the engine: an element comes out, and Element asks the same as membership", () => {
  const engine = bareEngine();
  declareCombinatorics(engine);
  const first = engine.box(["At", ["AlternatingSignMatrices", 6], 100]).evaluate().json;
  expect(JSON.stringify(first)).toContain("List");
  const element = (x: unknown) => engine.box(["Element", x, ["AlternatingSignMatrices", 3]] as never).evaluate().json;
  expect(element(["List", ["List", 0, 1, 0], ["List", 1, -1, 1], ["List", 0, 1, 0]])).toBe("True");
  expect(element(["List", ["List", 0, 1, 0], ["List", 1, 1, -1], ["List", 0, -1, 1]])).toBe("False");
});
