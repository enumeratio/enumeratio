// GelfandTsetlin defined in Epsil: row by row, each row's entries smallest first, against an
// independent generator of the triangles, and its count against the product formula.

import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { epsilKernelOn } from "../../collections/src/families/epsil.ts";
import { declareCombinatorics } from "../../src/index.ts";
import { gelfandTsetlin } from "../src/families/gelfand-tsetlin.ts";

const ce = bareEngine();
const kernel = epsilKernelOn(ce, gelfandTsetlin);

/** Every row of length `m` under `above` (entry i from above[i + 1] to above[i]), or with entries
 *  0..k when there is no row above, falling along the row; smallest entries first. */
function rowsUnder(above: number[] | undefined, m: number, k: number): number[][] {
  const out: number[][] = [];
  const build = (row: number[]): void => {
    const i = row.length;
    if (i === m) {
      out.push(row);
      return;
    }
    const [low, high] = above === undefined ? [0, k] : [above[i + 1], above[i]];
    for (let v = low; v <= high; v++) if (i === 0 || v <= row[i - 1]) build([...row, v]);
  };
  build([]);
  return out;
}

/** Every triangle of n rows with entries 0..k, in the order of its rows read top to bottom. */
function triangles(n: number, k: number): number[][][] {
  const grow = (rows: number[][]): number[][][] => {
    if (rows.length === n) return [rows];
    const above = rows.at(-1);
    return rowsUnder(above, n - rows.length, k).flatMap((row) => grow([...rows, row]));
  };
  return grow([]);
}

for (const [n, k] of [
  [0, 0],
  [0, 3],
  [1, 0],
  [1, 4],
  [2, 3],
  [3, 0],
  [3, 2],
  [4, 2],
  [3, 4],
]) {
  test(`GelfandTsetlin(${n}, ${k}) is every interlacing triangle, in the order of its rows`, () => {
    const expected = triangles(n, k);
    expect(kernel.count([n, k])).toBe(BigInt(expected.length));
    expected.forEach((triangle, r) => {
      expect(kernel.unrank([n, k], BigInt(r))).toEqual(triangle);
      expect(kernel.rank(triangle, [n, k])).toBe(BigInt(r));
    });
  });
}

test("membership over every triangle near the family", () => {
  const members = triangles(3, 2);
  const known = new Set(members.map((t) => JSON.stringify(t)));
  const near = (t: number[][]): number[][][] =>
    t.flatMap((row, i) =>
      row.flatMap((x, j) =>
        [x - 1, x + 1].map((y) => t.map((r, a) => (a === i ? r.map((z, b) => (b === j ? y : z)) : r))),
      ),
    );
  const tried = [
    ...members,
    ...members.flatMap(near),
    ...triangles(3, 3),
    ...triangles(2, 2),
    [],
    [[2, 1, 0]],
    [[1, 1, 1], [1, 1], [2]],
  ];
  expect(tried.filter((t) => !known.has(JSON.stringify(t))).length).toBeGreaterThan(50);
  for (const t of tried) expect([t, kernel.valid(t, [3, 2])]).toEqual([t, known.has(JSON.stringify(t))]);
});

test("the count is the product formula, exactly, past 2^53 where unrank and rank decline", () => {
  const product = (n: number, k: number): bigint => {
    let num = 1n;
    let den = 1n;
    for (let i = 1; i <= n; i++)
      for (let j = i; j <= n; j++) {
        num *= BigInt(k + i + j - 1);
        den *= BigInt(i + j - 1);
      }
    return num / den;
  };
  for (const [n, k] of [
    [5, 5],
    [8, 8],
    [10, 10],
  ])
    expect(kernel.count([n, k])).toBe(product(n, k));
  expect(product(10, 10) > 2n ** 53n).toBe(true);
  expect(() => kernel.unrank([10, 10], 0n)).toThrow(RangeError);
});

test("a large triangle round-trips", () => {
  const t = kernel.unrank([7, 7], 3_000_000_007n);
  expect(kernel.valid(t, [7, 7])).toBe(true);
  expect(kernel.rank(t, [7, 7])).toBe(3_000_000_007n);
});

test("Element asks the same as membership", () => {
  const engine = bareEngine();
  declareCombinatorics(engine);
  const rows = (...r: number[][]) => ["List", ...r.map((row) => ["List", ...row])];
  const element = (x: unknown) => engine.box(["Element", x, ["GelfandTsetlin", 2, 2]] as never).evaluate().json;
  expect(element(rows([2, 1], [1]))).toBe("True");
  expect(element(rows([2, 1], [2]))).toBe("True");
  expect(element(rows([2, 1], [0]))).toBe("False");
  expect(element(rows([1, 2], [1]))).toBe("False");
  expect(element(rows([3, 1], [1]))).toBe("False");
});
