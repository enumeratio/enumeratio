// StandardTableaux and ShiftedStandardTableaux defined in Epsil, against independent readings:
// every tableau grown a cell at a time, listed by shape and then by where n, n − 1, … sit.

import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { COMPILED_FAMILIES } from "../../collections/src/families/compiled-families.generated.js";
import { epsilKernelOn, kernelOn } from "../../collections/src/families/epsil.ts";
import { declareCombinatorics } from "../../src/index.ts";
import { shiftedStandardTableauxFast } from "../src/families/tableaux-plane.ts";
import { shiftedStandardTableaux, standardTableaux, standardTableauxFast } from "../src/families/standard-tableaux.ts";

const ce = bareEngine();
const standard = epsilKernelOn(ce, standardTableaux);
const shifted = epsilKernelOn(ce, shiftedStandardTableaux);

/** Every partition of `n`, largest part first (parts non-increasing). */
function partitions(n: number, most = n): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  for (let first = Math.min(n, most); first >= 1; first--)
    for (const rest of partitions(n - first, first)) out.push([first, ...rest]);
  return out;
}

const strict = (n: number): number[][] => partitions(n).filter((p) => p.every((x, i) => i === 0 || p[i - 1] > x));

type Tableau = number[][];

/** Every tableau of n cells grown one value at a time: `grow(lengths, row)` says whether row `row` of a
 *  diagram with these row lengths may take the next value. Listed by the shape's place in `shapes`, then
 *  by the rows of n, n − 1, … 1 in turn. */
function listed(n: number, shapes: number[][], grow: (lengths: number[], row: number) => boolean): Tableau[] {
  const found: { rows: number[]; tableau: Tableau }[] = [];
  const walk = (rowOf: number[], lengths: number[]): void => {
    if (rowOf.length === n) {
      const tableau: Tableau = lengths.map(() => []);
      rowOf.forEach((row, i) => tableau[row].push(i + 1));
      found.push({ rows: rowOf.toReversed(), tableau });
      return;
    }
    for (let row = 0; row <= lengths.length; row++) {
      if (!grow(lengths, row)) continue;
      const next = lengths.slice();
      next[row] = (next[row] ?? 0) + 1;
      walk([...rowOf, row], next);
    }
  };
  walk([], []);
  const place = (t: Tableau): number => shapes.findIndex((s) => s.join() === t.map((r) => r.length).join());
  const byRows = (a: number[], b: number[]): number => a.findIndex((x, i) => x !== b[i]);
  return found
    .toSorted((a, b) => {
      if (place(a.tableau) !== place(b.tableau)) return place(a.tableau) - place(b.tableau);
      const i = byRows(a.rows, b.rows);
      return i < 0 ? 0 : a.rows[i] - b.rows[i];
    })
    .map((f) => f.tableau);
}

// A cell goes in a row if the row stays no longer than the one above it.
const young = (lengths: number[], row: number): boolean => row === 0 || (lengths[row - 1] ?? 0) > (lengths[row] ?? 0);
// In a shifted diagram the row stays strictly shorter than the one above it.
const shiftedGrow = (lengths: number[], row: number): boolean =>
  row === 0 || (lengths[row - 1] ?? 0) > (lengths[row] ?? 0) + 1;

const involutions = (n: number): bigint => {
  const table = [1n, 1n];
  for (let m = 2; m <= n; m++) table.push(table[m - 1] + BigInt(m - 1) * table[m - 2]);
  return table[n];
};

for (const n of [0, 1, 2, 3, 4, 5, 6]) {
  test(`StandardTableaux(${n}) is every standard tableau, shape by shape, in the order of the corner n sits at`, () => {
    const expected = listed(n, partitions(n), young);
    expect(standard.count([n])).toBe(BigInt(expected.length));
    expect(standard.count([n])).toBe(involutions(n));
    expected.forEach((tableau, r) => {
      expect(standard.unrank([n], BigInt(r))).toEqual(tableau);
      expect(standard.rank(tableau, [n])).toBe(BigInt(r));
    });
  });
}

for (const n of [0, 1, 2, 3, 4, 5, 6, 7]) {
  test(`ShiftedStandardTableaux(${n}) is every shifted tableau, shape by shape, in the order of the corner n sits at`, () => {
    const expected = listed(n, strict(n), shiftedGrow);
    expect(shifted.count([n])).toBe(BigInt(expected.length));
    expected.forEach((tableau, r) => {
      expect(shifted.unrank([n], BigInt(r))).toEqual(tableau);
      expect(shifted.rank(tableau, [n])).toBe(BigInt(r));
    });
  });
}

/** Tableaux a step from `tableau`: an entry changed, dropped, repeated or swapped, a row cut off or doubled. */
function neighbours(tableau: Tableau): Tableau[] {
  const out: Tableau[] = [[], [[]], tableau.slice(1), tableau.toReversed(), [...tableau, tableau[0] ?? [1]]];
  tableau.forEach((row, i) => {
    const put = (changed: number[]): Tableau => tableau.map((r, j) => (i === j ? changed : r));
    out.push(put(row.slice(1)), put([...row, row[0]]), put(row.toReversed()), put(row.map((x) => x + 1)));
    row.forEach((x, j) => {
      out.push(put(row.map((y, k) => (j === k ? x - 1 : y))), put(row.map((y, k) => (j === k ? x + 1 : y))));
    });
  });
  return out.filter((t) => t.every(Array.isArray));
}

test("membership over every tableau near the families", () => {
  const cases = [
    {
      kernel: standard,
      family: { ...standardTableaux, fast: standardTableauxFast },
      shapes: partitions,
      grow: young,
      sizes: [0, 1, 2, 3, 4],
    },
    {
      kernel: shifted,
      family: { ...shiftedStandardTableaux, fast: shiftedStandardTableauxFast },
      shapes: strict,
      grow: shiftedGrow,
      sizes: [0, 1, 2, 3, 4, 5],
    },
  ];
  for (const { kernel, family, shapes, grow, sizes } of cases) {
    const fast = kernelOn(ce, family);
    expect(fast.fast).toBe(true);
    const bySize = sizes.map((m) => listed(m, shapes(m), grow));
    for (const n of sizes) {
      const known = new Set(bySize[n].map((t) => JSON.stringify(t)));
      const tried = [...bySize.flat(), ...bySize[n].flatMap(neighbours)];
      expect(tried.length).toBeGreaterThan(known.size);
      for (const near of tried) {
        const expected = known.has(JSON.stringify(near));
        expect([near, kernel.valid(near, [n])]).toEqual([near, expected]);
        expect([near, fast.valid(near, [n])]).toEqual([near, expected]);
      }
    }
  }
});

test("StandardTableaux and ShiftedStandardTableaux answer Element the same as their members", () => {
  const engine = bareEngine();
  declareCombinatorics(engine);
  const element = (x: unknown, family: unknown) => engine.box(["Element", x, family] as never).evaluate().json;
  const rows = (...r: number[][]) => ["List", ...r.map((row) => ["List", ...row])];
  expect(element(rows([1, 2], [3]), ["StandardTableaux", 3])).toBe("True");
  expect(element(rows([1, 3], [2]), ["StandardTableaux", 3])).toBe("True");
  expect(element(rows([1, 2, 3]), ["StandardTableaux", 3])).toBe("True");
  expect(element(rows([2, 1], [3]), ["StandardTableaux", 3])).toBe("False");
  expect(element(rows([1, 2], [2]), ["StandardTableaux", 3])).toBe("False");
  expect(element(rows([1, 2], [3]), ["StandardTableaux", 4])).toBe("False");
  expect(element(rows([1], [2], [3]), ["ShiftedStandardTableaux", 3])).toBe("False");
  expect(element(rows([1, 2], [3]), ["ShiftedStandardTableaux", 3])).toBe("True");
  expect(element(rows([1, 3], [2]), ["ShiftedStandardTableaux", 3])).toBe("False");
  expect(element(rows([1, 2, 3]), ["ShiftedStandardTableaux", 3])).toBe("True");
  expect(element(rows([1, 2], [3, 4]), ["ShiftedStandardTableaux", 4])).toBe("False");
  expect(element(["List", 1, 2, 3], ["StandardTableaux", 3])).toBe("False");
});

test("StandardTableaux(n) = involutions of n, exactly, past 2^53 where unrank and rank decline", () => {
  for (const n of [10, 27, 28, 60, 200]) expect(standard.count([n])).toBe(involutions(n));
  expect(involutions(28) > 2n ** 53n).toBe(true);
  expect(() => standard.unrank([60], 0n)).toThrow(RangeError);
});

test("a large tableau round-trips", () => {
  const t = standard.unrank([24], 12345678901234n);
  expect((t as number[][]).flat().toSorted((a, b) => a - b)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
  expect(standard.valid(t, [24])).toBe(true);
  expect(standard.rank(t, [24])).toBe(12345678901234n);
  const s = shifted.unrank([30], 987654321n);
  expect(shifted.valid(s, [30])).toBe(true);
  expect(shifted.rank(s, [30])).toBe(987654321n);
});

test("ShiftedStandardTableaux declines a count past 2^53", () => {
  expect(() => shifted.count([40])).toThrow(RangeError);
});

test("the shapes' tables are built once per n, not per call", () => {
  const built: string[] = [];
  const counted = kernelOn(bareEngine(), standardTableaux, COMPILED_FAMILIES, {
    onTables: (p, precision) => built.push(`${p.join(",")}:${precision}`),
  });
  for (let i = 0; i < 5; i++) {
    const t = counted.unrank([9], BigInt(i * 100));
    expect(counted.valid(t, [9])).toBe(true);
    expect(counted.rank(t, [9])).toBe(BigInt(i * 100));
  }
  expect(built.length).toBeLessThanOrEqual(1);
});
