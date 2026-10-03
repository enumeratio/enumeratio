// The recursive maps are defined in Epsil alone. Each is checked here against an independent
// TypeScript reading of the same bijection (the collections' own kernels where they have one),
// over every small value of its source carrier and a few values that aren't the carrier's,
// which both must decline.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import {
  BinaryTreeOfParentArray,
  BinaryTreeParentArray,
  BinaryTreeUnrank,
  type BinTree,
  DyckPathUnrank,
} from "../collections/src/families/kernels-extra.ts";
import { Factorial, PermutationUnrank } from "../collections/src/families/kernels.ts";
import { CycleDecomposition, PermutationOfCycleDecomposition } from "../permutations/src/families/permutations.ts";
import { evaluateDefinition, MAPS } from "../src/maps.ts";

const MAX = 4;
const catalan = (n: number): number => (n === 0 ? 1 : ((4 * n - 2) * catalan(n - 1)) / (n + 1));
const upTo = <T>(count: (n: number) => number, unrank: (n: number, r: number) => T): T[] =>
  Array.from({ length: MAX + 1 }, (_, n) => Array.from({ length: count(n) }, (_, r) => unrank(n, r))).flat();

const list = (values: readonly unknown[]): unknown => ["List", ...values];
const nested = (tree: BinTree): unknown => (tree === 0 ? 0 : list([nested(tree[0]), nested(tree[1])]));
const treeOf = (json: unknown): BinTree | undefined => {
  if (json === 0) return 0;
  if (!Array.isArray(json) || json[0] !== "List" || json.length !== 3) return undefined;
  const [l, r] = [treeOf(json[1]), treeOf(json[2])];
  return l === undefined || r === undefined ? undefined : [l, r];
};
const intsOf = (json: unknown): number[] => (json as unknown[]).slice(1) as number[];

// Mp00012 and its inverse, read directly.
const dyckOf = (t: BinTree): number[] => (t === 0 ? [] : [1, ...dyckOf(t[0]), 0, ...dyckOf(t[1])]);
function treeOfDyck(word: readonly number[]): BinTree | undefined {
  if (word.length === 0) return 0;
  let height = 0;
  for (let j = 0; j < word.length; j++) {
    height += word[j] === 1 ? 1 : -1;
    if (height < 0) return undefined;
    if (height === 0) {
      const [l, r] = [treeOfDyck(word.slice(1, j)), treeOfDyck(word.slice(j + 1))];
      return l === undefined || r === undefined ? undefined : [l, r];
    }
  }
  return undefined;
}

/** Entry i counts the earlier entries larger than it. */
const inversionSequence = (p: readonly number[]): number[] =>
  p.map((v, i) => p.slice(0, i).filter((w) => w > v).length);
/** Filled from the right: the last entry is the (a + 1)-th largest of the values still free. */
function permutationOfInversionSequence(a: readonly number[]): number[] | undefined {
  if (!a.every((v, i) => Number.isInteger(v) && v >= 0 && v <= i)) return undefined;
  const free = Array.from({ length: a.length }, (_, i) => i + 1);
  const p: number[] = [];
  for (let i = a.length - 1; i >= 0; i--) p[i] = free.splice(free.length - 1 - a[i]!, 1)[0]!;
  return p;
}
const subexcedants = (n: number): number[][] =>
  Array.from({ length: n }, (_, i) => i + 1).reduce<number[][]>(
    (words, bound) => words.flatMap((w) => Array.from({ length: bound }, (_, a) => [...w, a])),
    [[]],
  );
const maybe = <T>(value: T | undefined, encode: (value: T) => unknown): unknown =>
  value === undefined ? undefined : encode(value);

/** The reference reading of each map, by name and source carrier; undefined declines. */
const REFERENCE: Record<string, (contents: unknown) => unknown> = {
  "BinaryTreeParentArray from binary_tree": (x) => list(BinaryTreeParentArray(treeOf(x)!)),
  "BinaryTree from binary_tree_parent_array": (x) => maybe(BinaryTreeOfParentArray(intsOf(x)), nested),
  "DyckPath from binary_tree": (x) => list(dyckOf(treeOf(x)!)),
  "BinaryTree from dyck_path": (x) => maybe(treeOfDyck(intsOf(x)), nested),
  "CycleDecomposition from permutation": (x) => list(CycleDecomposition(intsOf(x)).map(list)),
  "Permutation from cycle_decomposition": (x) => maybe(PermutationOfCycleDecomposition(intsOf(x).map(intsOf)), list),
  "SubexcedantSeq from permutation": (x) => list(inversionSequence(intsOf(x))),
  "Permutation from subexcedant_seq": (x) => maybe(permutationOfInversionSequence(intsOf(x)), list),
};

const trees = upTo(catalan, BinaryTreeUnrank);
const permutations = upTo(Factorial, PermutationUnrank);

/** Contents of every small value of each source carrier, then some that aren't one. */
const SUBJECTS: Record<string, unknown[]> = {
  binary_tree: trees.map(nested),
  binary_tree_parent_array: [
    ...trees.map((t) => list(BinaryTreeParentArray(t))),
    list([2, 1]),
    list([0, 0]),
    list([2, 0, 1]),
  ],
  dyck_path: [...upTo(catalan, DyckPathUnrank).map(list), list([0, 1]), list([1, 1]), list([1, 0, 0, 1])],
  permutation: permutations.map(list),
  cycle_decomposition: [
    ...permutations.map((p) => list(CycleDecomposition(p).map(list))),
    list([list([2, 1])]),
    list([list([1]), list([1])]),
    list([list([2]), list([1])]),
  ],
  subexcedant_seq: [
    ...Array.from({ length: MAX + 1 }, (_, n) => subexcedants(n).map(list)).flat(),
    list([1]),
    list([0, 2]),
    list([0, 0, 3]),
    list([0, -1]),
  ],
};

const ce = new ComputeEngine();

for (const [key, reference] of Object.entries(REFERENCE)) {
  const map = MAPS.find((m) => `${m.name} from ${m.from}` === key);
  test(`${key}: its definition agrees with a direct reading`, () => {
    expect(map, key).toBeDefined();
    for (const contents of SUBJECTS[map!.from]!)
      expect(evaluateDefinition(ce, map!, contents), JSON.stringify(contents)).toEqual(reference(contents));
  });
}
