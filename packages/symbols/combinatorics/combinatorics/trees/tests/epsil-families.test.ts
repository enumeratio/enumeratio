// The trees-area families defined in Epsil against their TS kernels (which stay as the independent
// reading): the same count, the same element at every rank, rank inverting unrank, and the same
// membership over members and near misses. Compiled and interpreted; past 2^53, where the
// interpreter's exact integers take over, under DEEP_TESTS.

// unstable: the tests build an engine to run the families on.
import { ComputeEngine } from "@enumeratio/engine/unstable";
import { evaluateEpsil } from "@enumeratio/structures";
import { expect, test } from "vite-plus/test";
import { type EpsilFamily, epsilKernelOn, evaluateTables } from "../../collections/src/families/epsil.ts";
import { pruferDecode } from "../../collections/src/families/kernels-extra.ts";
import type { NumberKernel } from "../../collections/src/families/types.ts";
import { binaryTreeParentArrays } from "../src/families/binary-tree-parents.ts";
import { binaryTreeParentArraysKernel } from "../src/families/core.ts";
import { entries as labeledEntries, labeledTreesKernel } from "../src/families/labeled.ts";
import { entries as rootedForestEntries, rootedForestsKernel } from "../src/families/rooted-forests.ts";
import { nonCrossingTrees } from "../src/families/noncrossing-trees.ts";
import {
  entries as unlabeledEntries,
  nonCrossingTreesKernel,
  phylogeneticTreesKernel,
} from "../src/families/unlabeled-trees.ts";

const DEEP = process.env.DEEP_TESTS === "1";
const ce = new ComputeEngine();

interface Reading {
  readonly kernel: NumberKernel;
  readonly params: readonly number[][];
  /** Candidates for membership besides the members: near misses. */
  readonly near: (p: number[], members: unknown[]) => unknown[];
}

/** Every word of length `length` over `alphabet`. */
function words(length: number, alphabet: readonly number[]): number[][] {
  if (length === 0) return [[]];
  return words(length - 1, alphabet).flatMap((w) => alphabet.map((a) => [...w, a]));
}
const span = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** The k-element subsets of `items`, in order. */
function subsets<T>(items: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  return items.flatMap((x, i) => subsets(items.slice(i + 1), k - 1).map((rest) => [x, ...rest]));
}

/** Edge lists a step from a tree's: an endpoint moved, an edge repeated, flipped, dropped or added. */
function edgeNeighbours(tree: number[][], n: number): number[][][] {
  const moved = tree.flatMap((edge, i) =>
    [0, 1].flatMap((side) =>
      [-1, 1].map((d) => tree.map((e, j) => (i === j ? e.map((v, s) => (s === side ? v + d : v)) : e))),
    ),
  );
  return [
    ...moved,
    tree.map((e, i) => (i === 0 ? tree[tree.length - 1] : e)),
    tree.map((e, i) => (i === 0 ? [e[1], e[0]] : e)),
    tree.slice(1),
    [...tree, [1, n]],
    tree.map((e, i) => (i === 0 ? [e[0]] : e)),
  ];
}

/** Words a step from `word`: an entry moved by one, or two entries swapped. */
const wordNeighbours = (word: number[]): number[][] => [
  ...word.flatMap((_, i) => [-1, 1].map((d) => word.map((v, j) => (i === j ? v + d : v)))),
  ...word.flatMap((a, i) =>
    word.slice(i + 1).map((b, k) => word.map((v, j) => (j === i ? b : j === i + 1 + k ? a : v))),
  ),
];

const READINGS: Record<string, Reading & { family: EpsilFamily }> = {
  NonCrossingTrees: {
    family: nonCrossingTrees,
    kernel: nonCrossingTreesKernel,
    params: [[0], [1], [2], [3], [4], [5], ...(DEEP ? [[6]] : [])],
    // Every 0/3 word up to n = 3, and each member with an entry toggled, moved, swapped, dropped or added.
    near: ([n], members) => [
      ...(n <= 3 ? words(3 * n + 1, [0, 3]) : []),
      ...(members as number[][]).flatMap((w) => [
        ...wordNeighbours(w),
        ...w.map((a, i) => w.map((v, j) => (i === j ? 3 - v : v))),
        w.slice(1),
        [...w, 0],
      ]),
    ],
  },
  BinaryTreeParentArrays: {
    family: binaryTreeParentArrays,
    kernel: binaryTreeParentArraysKernel,
    params: [[0], [1], [2], [3], [4], [5], ...(DEEP ? [[6]] : [])],
    // Every word up to n = 4; past it each member with an entry moved or two entries swapped.
    near: ([n], members) => [
      ...(n <= 4 ? words(n, span(0, n + 1)) : (members as number[][]).flatMap(wordNeighbours)),
      ...(n > 0 ? words(n - 1, span(0, n)).slice(0, 500) : []),
      ...words(n + 1, span(0, 1)),
    ],
  },
  LabeledTrees: {
    family: labeledEntries[0],
    kernel: labeledTreesKernel,
    params: [[1], [2], [3], [4], [5]],
    near: ([n], members) => [
      ...(members as number[][][]).flatMap((tree) => edgeNeighbours(tree, n)),
      // Every set of n − 1 distinct pairs: the trees among them and the graphs that aren't.
      ...subsets(
        span(1, n).flatMap((u) => span(u + 1, n).map((v) => [u, v])),
        n - 1,
      ),
    ],
  },
  RootedForests: {
    family: rootedForestEntries[0],
    kernel: rootedForestsKernel,
    params: [[0], [1], [2], [3], [4], [5]],
    near: ([n]) => [
      ...words(n, span(0, n + 1)),
      ...(n > 0 ? words(n - 1, span(0, n)) : []),
      ...words(n + 1, span(0, 1)),
    ],
  },
  PhylogeneticTrees: {
    family: unlabeledEntries.find((f) => f.head === "PhylogeneticTrees") as EpsilFamily,
    kernel: phylogeneticTreesKernel,
    params: [[1], [2], [3], [4], [5], [6]],
    near: ([n]) => [
      ...words(Math.max(n - 2, 0), span(-1, 2 * n)).filter((w) => w.length < 5 || w.every((d) => d <= 1)),
      ...words(Math.max(n - 2, 0) + 1, span(0, 1)),
    ],
  },
};

for (const [head, reading] of Object.entries(READINGS)) {
  const kernel = epsilKernelOn(ce, reading.family);
  const ts = reading.kernel;
  for (const p of reading.params) {
    test(`${head}(${p.join(", ")}) agrees with its TS kernel`, () => {
      const total = ts.count(p);
      expect(kernel.count(p)).toBe(BigInt(total));
      const members: unknown[] = [];
      for (let r = 0; r < total; r++) {
        const element = kernel.unrank(p, BigInt(r));
        expect(element).toEqual(ts.unrank(p, r));
        expect(kernel.valid(element, p)).toBe(true);
        expect(kernel.rank(element, p)).toBe(BigInt(r));
        expect(ts.rank(element, p)).toBe(r);
        members.push(element);
      }
      for (const candidate of reading.near(p, members))
        expect([candidate, kernel.valid(candidate, p)]).toEqual([candidate, ts.valid(candidate, p)]);
    });
  }
}

/** The definitions as the interpreter reads them, bypassing compiled code. */
const interpreted = (family: EpsilFamily, operation: keyof EpsilFamily["epsil"], bindings: Record<string, unknown>) => {
  const { tables } = family.epsil;
  const tabled = tables === undefined ? bindings : { ...bindings, _tables: evaluateTables(ce, tables, bindings) };
  return evaluateEpsil(ce, family.epsil[operation], tabled);
};

const list = (xs: unknown[]): unknown => ["List", ...xs.map((x) => (Array.isArray(x) ? list(x) : x))];

test("the interpreter agrees with compiled code", () => {
  for (const [head, reading] of Object.entries(READINGS)) {
    const family = reading.family;
    const p = reading.params.at(-2)!;
    const bind = Object.fromEntries(family.params.map((name, i) => [name, p[i]]));
    const total = reading.kernel.count(p);
    expect(interpreted(family, "count", bind)).toBe(total);
    for (const r of [0, Math.floor(total / 2), total - 1]) {
      const element = reading.kernel.unrank(p, r);
      expect([head, interpreted(family, "unrank", { ...bind, _r: r })]).toEqual([head, list(element as unknown[])]);
      expect([head, interpreted(family, "rank", { ...bind, _x: list(element as unknown[]) })]).toEqual([head, r]);
      expect([head, interpreted(family, "valid", { ...bind, _x: list(element as unknown[]) })]).toEqual([head, "True"]);
    }
  }
});

// Compiled code computes in doubles and answers while a fiber's count is a safe integer: its
// last such size is checked against independent BigInt readings, and past it (under DEEP_TESTS)
// the interpreter's exact integers. The TS kernels compute in doubles too, so they can't be the
// reading there.
const pruferOf = (n: number, r: bigint): number[] => {
  const digits: number[] = [];
  let rest = r;
  for (let i = 0; i < n - 2; i++) {
    digits.unshift(Number(rest % BigInt(n)) + 1);
    rest /= BigInt(n);
  }
  return digits;
};

const exactRanks = (total: bigint): bigint[] => [0n, 1n, total / 3n, total / 2n, total - 2n, total - 1n];

function checkLabeledTrees(n: number): void {
  const kernel = epsilKernelOn(ce, READINGS.LabeledTrees.family);
  const total = BigInt(n) ** BigInt(n - 2);
  expect(kernel.count([n])).toBe(total);
  for (const r of exactRanks(total)) {
    const tree = kernel.unrank([n], r);
    expect(tree).toEqual(pruferDecode(pruferOf(n, r), n));
    expect(kernel.valid(tree, [n])).toBe(true);
    expect(kernel.rank(tree, [n])).toBe(r);
  }
}

function checkRootedForests(n: number): void {
  const kernel = epsilKernelOn(ce, READINGS.RootedForests.family);
  const total = BigInt(n + 1) ** BigInt(n - 1);
  expect(kernel.count([n])).toBe(total);
  for (const r of exactRanks(total)) {
    const forest = kernel.unrank([n], r);
    expect(kernel.valid(forest, [n])).toBe(true);
    expect(kernel.rank(forest, [n])).toBe(r);
    // The forest is the labeled tree on n + 1 vertices of the same sequence, rooted at n + 1.
    const parent = Array.from({ length: n }, () => 0);
    const adjacent = new Map<number, number[]>();
    for (const [u, v] of pruferDecode(pruferOf(n + 1, r), n + 1)) {
      adjacent.set(u, [...(adjacent.get(u) ?? []), v]);
      adjacent.set(v, [...(adjacent.get(v) ?? []), u]);
    }
    const queue = [n + 1];
    const seen = new Set(queue);
    for (const at of queue)
      for (const next of adjacent.get(at) ?? [])
        if (!seen.has(next)) {
          seen.add(next);
          parent[next - 1] = at === n + 1 ? 0 : at;
          queue.push(next);
        }
    expect(forest).toEqual(parent);
  }
}

function checkPhylogeneticTrees(n: number): void {
  const kernel = epsilKernelOn(ce, READINGS.PhylogeneticTrees.family);
  let total = 1n;
  for (let k = 3n; k <= BigInt(n); k++) total *= 2n * k - 3n;
  expect(kernel.count([n])).toBe(total);
  for (const r of exactRanks(total)) {
    const digits = kernel.unrank([n], r) as number[];
    let value = 0n;
    digits.forEach((d, i) => (value = value * BigInt(2 * (i + 1) + 1) + BigInt(d)));
    expect(value).toBe(r);
    expect(kernel.valid(digits, [n])).toBe(true);
    expect(kernel.rank(digits, [n])).toBe(r);
  }
}

/** The Catalan numbers C_0..C_n, exactly. */
const catalans = (n: number): bigint[] => {
  const catalan = [1n];
  for (let k = 0; k < n; k++) catalan.push((catalan[k] * BigInt(4 * k + 2)) / BigInt(k + 2));
  return catalan;
};

function checkBinaryTreeParentArrays(n: number): void {
  const kernel = epsilKernelOn(ce, READINGS.BinaryTreeParentArrays.family);
  const catalan = catalans(n);
  // The parent array by the interval decomposition, in BigInt.
  const parentsOf = (lo: number, size: number, parent: number, rank: bigint, out: number[]): void => {
    let rest = rank;
    for (let left = 0; left < size; left++) {
      const right = catalan[size - 1 - left];
      const block = catalan[left] * right;
      if (rest < block) {
        out[lo + left - 1] = parent;
        if (left > 0) parentsOf(lo, left, lo + left, rest / right, out);
        if (size - 1 - left > 0) parentsOf(lo + left + 1, size - 1 - left, lo + left, rest % right, out);
        return;
      }
      rest -= block;
    }
  };
  expect(kernel.count([n])).toBe(catalan[n]);
  for (const r of exactRanks(catalan[n])) {
    const expected = Array.from({ length: n }, () => 0);
    parentsOf(1, n, 0, r, expected);
    const tree = kernel.unrank([n], r);
    expect(tree).toEqual(expected);
    expect(kernel.valid(tree, [n])).toBe(true);
    expect(kernel.rank(tree, [n])).toBe(r);
  }
}

/** The ternary tree numbers C(3n, n) / (2n + 1), exactly. */
const ternaryTrees = (n: number): bigint => {
  let choose = 1n;
  for (let i = 1n; i <= BigInt(n); i++) choose = (choose * (BigInt(3 * n) - i + 1n)) / i;
  return choose / BigInt(2 * n + 1);
};

test("at the last n whose count a double holds, compiled code answers exactly", () => {
  checkLabeledTrees(15);
  checkRootedForests(14);
  checkPhylogeneticTrees(16);
  checkBinaryTreeParentArrays(30);
  // NonCrossingTrees: the TS kernel is exact here too, since its sums stay below the count.
  const kernel = epsilKernelOn(ce, READINGS.NonCrossingTrees.family);
  const n = 22;
  const total = ternaryTrees(n);
  expect(kernel.count([n])).toBe(total);
  for (const r of exactRanks(total)) {
    const word = kernel.unrank([n], r);
    expect(word).toEqual(nonCrossingTreesKernel.unrank([n], Number(r)));
    expect(kernel.valid(word, [n])).toBe(true);
    expect(kernel.rank(word, [n])).toBe(r);
  }
});

test("past 2^53 the stack walks decline, the count stays exact", () => {
  expect(epsilKernelOn(ce, READINGS.BinaryTreeParentArrays.family).count([31])).toBe(catalans(31)[31]);
  expect(epsilKernelOn(ce, READINGS.NonCrossingTrees.family).count([23])).toBe(ternaryTrees(23));
  for (const [head, p] of [
    ["BinaryTreeParentArrays", [31]],
    ["NonCrossingTrees", [23]],
  ] as const)
    expect(() => epsilKernelOn(ce, READINGS[head].family).unrank([...p], 0n)).toThrow(RangeError);
});

test.skipIf(!DEEP)("past 2^53 LabeledTrees answers in exact integers", () => checkLabeledTrees(18));
test.skipIf(!DEEP)("past 2^53 RootedForests answers in exact integers", () => checkRootedForests(17));
test.skipIf(!DEEP)("past 2^53 PhylogeneticTrees answers in exact integers", () => checkPhylogeneticTrees(22));
