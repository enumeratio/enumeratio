// SemistandardTableaux defined in Epsil: by shape (the row lengths in lex order) and then by the
// entries read along the rows, against an independent generator, and its count against the
// hook-content formula.

import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { epsilKernelOn } from "../../collections/src/families/epsil.ts";
import { declareCombinatorics } from "../../src/index.ts";
import { semistandardTableaux } from "../src/families/semistandard-tableaux.ts";

const kernel = epsilKernelOn(bareEngine(), semistandardTableaux);

type Tableau = number[][];

/** Every partition of `n`, smallest row lengths first (lex, a shorter row list first). */
function shapes(n: number, most = n): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  for (let first = 1; first <= Math.min(n, most); first++)
    for (const rest of shapes(n - first, first)) out.push([first, ...rest]);
  return out.toSorted((a, b) => {
    const i = a.findIndex((x, j) => x !== b[j]);
    return i < 0 ? a.length - b.length : a[i] - b[i];
  });
}

/** Every filling of `shape` with 1..k, weakly increasing along rows, strictly down columns, cell by cell in order. */
function fillings(shape: number[], k: number): Tableau[] {
  const out: Tableau[] = [];
  const grid: Tableau = shape.map((m) => Array(m).fill(0));
  const fill = (r: number, c: number): void => {
    if (r === shape.length) {
      out.push(grid.map((row) => row.slice()));
      return;
    }
    if (c === shape[r]) return fill(r + 1, 0);
    for (let v = 1; v <= k; v++) {
      if (c > 0 && grid[r][c - 1] > v) continue;
      if (r > 0 && grid[r - 1][c] >= v) continue;
      grid[r][c] = v;
      fill(r, c + 1);
    }
  };
  fill(0, 0);
  return out;
}

const listed = (n: number, k: number): Tableau[] => shapes(n).flatMap((shape) => fillings(shape, k));

for (const [n, k] of [
  [0, 0],
  [0, 3],
  [1, 0],
  [1, 3],
  [2, 1],
  [3, 2],
  [4, 2],
  [4, 3],
  [5, 3],
  [6, 2],
]) {
  test(`SemistandardTableaux(${n}, ${k}) is every filling of every shape, shapes then entries in lex order`, () => {
    const expected = listed(n, k);
    expect(kernel.count([n, k])).toBe(BigInt(expected.length));
    expected.forEach((tableau, r) => {
      expect(kernel.unrank([n, k], BigInt(r))).toEqual(tableau);
      expect(kernel.rank(tableau, [n, k])).toBe(BigInt(r));
    });
  });
}

test("membership over every tableau near the family", () => {
  const members = listed(4, 3);
  const known = new Set(members.map((t) => JSON.stringify(t)));
  const near = (t: Tableau): Tableau[] =>
    t.flatMap((row, i) =>
      row.flatMap((x, j) =>
        [x - 1, x + 1].map((y) => t.map((r, a) => (a === i ? r.map((z, b) => (b === j ? y : z)) : r))),
      ),
    );
  const tried = [
    ...members,
    ...members.flatMap(near),
    ...listed(4, 4),
    ...listed(3, 3),
    ...members.map((t) => t.toReversed()),
    [[1, 2], [3], [3, 4]],
    [[]],
    [],
    [[1, 1, 1, 1], []],
  ];
  expect(tried.filter((t) => !known.has(JSON.stringify(t))).length).toBeGreaterThan(100);
  for (const t of tried) expect([t, kernel.valid(t, [4, 3])]).toEqual([t, known.has(JSON.stringify(t))]);
});

test("the count is the hook-content formula over every shape, exactly, past 2^53 where the count declines", () => {
  const hookContent = (shape: number[], k: number): bigint => {
    const conjugate =
      shape[0] === undefined ? [] : Array.from({ length: shape[0] }, (_, c) => shape.filter((m) => m > c).length);
    let num = 1n;
    let den = 1n;
    shape.forEach((m, r) =>
      Array.from({ length: m }, (_, c) => {
        num *= BigInt(Math.max(k + c - r, 0));
        den *= BigInt(m - c + conjugate[c] - r - 1);
      }),
    );
    return num / den;
  };
  for (const [n, k] of [
    [8, 4],
    [10, 5],
    [14, 6],
  ])
    expect(kernel.count([n, k])).toBe(shapes(n).reduce((sum, shape) => sum + hookContent(shape, k), 0n));
  expect(shapes(30).reduce((sum, shape) => sum + hookContent(shape, 14), 0n)).toBeGreaterThan(2n ** 53n);
  expect(() => kernel.count([30, 14])).toThrow(RangeError);
});

test("a larger tableau round-trips", () => {
  const t = kernel.unrank([12, 6], 123456n);
  expect(kernel.valid(t, [12, 6])).toBe(true);
  expect(kernel.rank(t, [12, 6])).toBe(123456n);
});

test("through the engine: an element comes out, and Element asks the same as membership", () => {
  const engine = bareEngine();
  declareCombinatorics(engine);
  const rows = (...r: number[][]) => ["List", ...r.map((row) => ["List", ...row])];
  const element = (x: unknown) => engine.box(["Element", x, ["SemistandardTableaux", 4, 3]] as never).evaluate().json;
  expect(element(rows([1, 1, 2], [3]))).toBe("True");
  expect(element(rows([1, 2, 2], [1]))).toBe("False");
  expect(element(rows([1, 1], [2, 2]))).toBe("True");
  expect(element(rows([1, 2], [1, 3]))).toBe("False");
  expect(element(rows([1, 1, 4], [2]))).toBe("False");
  expect(engine.box(["At", ["SemistandardTableaux", 4, 3], 1]).evaluate().json).toEqual(rows([1, 1], [2], [3]));
});
