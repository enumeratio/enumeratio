import { bareEngine } from "@enumeratio/engine/testing";
import { declareStructures } from "@enumeratio/structures";
import { expect, test } from "vite-plus/test";
import { declareCombinatorics } from "../src/index.ts";

// The statistics `src/statistics/carriers.ts` defines, against readings written straight from
// their descriptions (FindStat's where it has one) over every small object.
const ce = bareEngine();
declareStructures(ce);
declareCombinatorics(ce);

const stat = (carrier: string, value: unknown, name: string): number =>
  ce.box(["CombinatorialStat", [carrier, value], `'${name}'`] as never).evaluate().re;
const list = (items: readonly unknown[]): unknown => ["List", ...items];
const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);
const check = (carrier: string, name: string, objects: Iterable<[unknown, number]>): void => {
  for (const [value, expected] of objects)
    expect(stat(carrier, value, name), `${name} ${JSON.stringify(value)}`).toBe(expected);
};

/** Every word of length `n` over `letters`. */
const words = (letters: readonly number[], n: number): number[][] =>
  n === 0 ? [[]] : words(letters, n - 1).flatMap((w) => letters.map((l) => [...w, l]));

test("signed permutation descents count a drop from the fixed 0 before the first entry", () => {
  const signed = [1, 2, 3].flatMap((n) =>
    words([-3, -2, -1, 1, 2, 3], n).filter(
      (w) => new Set(w.map(Math.abs)).size === n && w.every((v) => Math.abs(v) <= n),
    ),
  );
  check(
    "SignedPermutation",
    "Descents",
    signed.map((w) => [list(w), [0, ...w].slice(1).filter((v, i) => [0, ...w][i]! > v).length]),
  );
});

/** Every standard tableau with `n` entries, as rows: each entry goes on the end of a row that stays a partition. */
function tableaux(n: number): number[][][] {
  let all: number[][][] = [[]];
  for (let entry = 1; entry <= n; entry++)
    all = all.flatMap((t) =>
      [...t.keys(), t.length]
        .filter((r) => r === t.length || r === 0 || t[r]!.length < t[r - 1]!.length)
        .map((r) => (r === t.length ? [...t, [entry]] : t.map((row, i) => (i === r ? [...row, entry] : row)))),
    );
  return all;
}

test("standard tableau descents and major index", () => {
  const all = [2, 3, 4, 5].flatMap(tableaux);
  const descents = (t: number[][]): number[] => {
    const rowOf = (v: number): number => t.findIndex((row) => row.includes(v));
    const n = sum(t.map((row) => row.length));
    return Array.from({ length: n - 1 }, (_, i) => i + 1).filter((i) => rowOf(i + 1) > rowOf(i));
  };
  check(
    "StandardTableau",
    "Descents",
    all.map((t) => [list(t.map(list)), descents(t).length]),
  );
  check(
    "StandardTableau",
    "MajorIndex",
    all.map((t) => [list(t.map(list)), sum(descents(t))]),
  );
});

/** The valid paths of semilength up to 6 over `steps` that never go below the axis and end on it. */
const paths = (steps: readonly number[], rise: (s: number) => number): number[][] =>
  [2, 3, 4, 5, 6]
    .flatMap((n) => words(steps, n))
    .filter((w) => {
      let h = 0;
      for (const s of w) if ((h += rise(s)) < 0) return false;
      return h === 0;
    });
const heights = (w: readonly number[], rise: (s: number) => number): number[] =>
  w.map((_, i) => sum(w.slice(0, i + 1).map(rise)));

test("Motzkin and Schroeder path height, peaks and hills", () => {
  const motzkin = paths([1, 0, -1], (s) => s);
  const schroeder = paths([1, -1, 2], (s) => (s === 2 ? 0 : s));
  const peaks = (w: readonly number[]): number => w.filter((s, i) => s === 1 && w[i + 1] === -1).length;
  check(
    "MotzkinPath",
    "Height",
    motzkin.map((w) => [list(w), Math.max(0, ...heights(w, (s) => s))]),
  );
  check(
    "MotzkinPath",
    "Peaks",
    motzkin.map((w) => [list(w), peaks(w)]),
  );
  const rise = (s: number): number => (s === 2 ? 0 : s);
  check(
    "SchroederPath",
    "Height",
    schroeder.map((w) => [list(w), Math.max(0, ...heights(w, rise))]),
  );
  check(
    "SchroederPath",
    "Peaks",
    schroeder.map((w) => [list(w), peaks(w)]),
  );
  // A hill: an up step from the axis, straight back down.
  check(
    "SchroederPath",
    "Hills",
    schroeder.map((w) => [list(w), w.filter((s, i) => s === 1 && w[i + 1] === -1 && heights(w, rise)[i] === 1).length]),
  );
});

test("composition descents and parts equal to one", () => {
  const compositions = (n: number): number[][] =>
    n === 0
      ? [[]]
      : Array.from({ length: n }, (_, k) => k + 1).flatMap((p) => compositions(n - p).map((c) => [p, ...c]));
  const all = [1, 2, 3, 4, 5, 6].flatMap(compositions);
  check(
    "Composition",
    "Descents",
    all.map((c) => [list(c), c.filter((p, i) => i > 0 && c[i - 1]! > p).length]),
  );
  check(
    "Composition",
    "PartsEqualOne",
    all.map((c) => [list(c), c.filter((p) => p === 1).length]),
  );
});

test("ordered tree unary nodes and labeled tree leaves", () => {
  type Tree = Tree[];
  /** The ordered trees on `n` vertices: a root over a forest of `n - 1`. */
  const forests = (size: number): Tree[][] =>
    size === 0
      ? [[]]
      : Array.from({ length: size }, (_, k) => k + 1).flatMap((first) =>
          forests(first - 1).flatMap((children) => forests(size - first).map((rest) => [children, ...rest])),
        );
  const trees = (n: number): Tree[] => forests(n - 1);
  const json = (t: Tree): unknown => list(t.map(json));
  const unary = (t: Tree): number => (t.length === 1 ? 1 : 0) + sum(t.map(unary));
  check(
    "OrderedTree",
    "UnaryNodes",
    [1, 2, 3, 4, 5].flatMap(trees).map((t) => [json(t), unary(t)]),
  );

  // Prufer sequences give every labeled tree on 4 and 5 vertices.
  const decode = (seq: readonly number[], n: number): number[][] => {
    const degree = Array.from({ length: n + 1 }, () => 1);
    for (const s of seq) degree[s]!++;
    const edges: number[][] = [];
    for (const s of seq) {
      const leaf = degree.findIndex((d, v) => v > 0 && d === 1);
      edges.push([leaf, s]);
      degree[leaf]!--;
      degree[s]!--;
    }
    const last = degree.flatMap((d, v) => (v > 0 && d === 1 ? [v] : []));
    return [...edges, last];
  };
  const labeled = [4, 5].flatMap((n) =>
    words(
      Array.from({ length: n }, (_, i) => i + 1),
      n - 2,
    ).map((seq) => decode(seq, n)),
  );
  check(
    "LabeledTree",
    "Leaves",
    labeled.map((edges) => [
      list(edges.map(list)),
      [...new Set(edges.flat())].filter((v) => edges.flat().filter((u) => u === v).length === 1).length,
    ]),
  );
});

test("plane partition largest part and trace", () => {
  /** Rows of weakly decreasing entries, each row entrywise below the one before, with total `n`. */
  const planePartitions = (n: number): number[][][] => {
    const rowsBelow = (above: readonly number[] | undefined, left: number): number[][][] => {
      if (left === 0) return [[]];
      // The next row is a partition, entrywise at most the row above; nonempty rows only.
      const rows: number[][] = [];
      const grow = (row: number[]): void => {
        if (row.length > 0) rows.push(row);
        const cap = Math.min(row.at(-1) ?? left, above?.[row.length] ?? left, left - sum(row));
        for (let v = 1; v <= cap; v++) grow([...row, v]);
      };
      grow([]);
      return rows.flatMap((row) =>
        row.length > (above?.length ?? row.length) ? [] : rowsBelow(row, left - sum(row)).map((rest) => [row, ...rest]),
      );
    };
    return rowsBelow(undefined, n);
  };
  const all = [1, 2, 3, 4, 5].flatMap(planePartitions);
  expect(all.length).toBeGreaterThan(20);
  const rows = (p: number[][]): unknown => list(p.map(list));
  check(
    "PlanePartition",
    "LargestPart",
    all.map((p) => [rows(p), Math.max(...p.flat())]),
  );
  check(
    "PlanePartition",
    "Trace",
    all.map((p) => [rows(p), sum(p.map((row, i) => row[i] ?? 0))]),
  );
});
