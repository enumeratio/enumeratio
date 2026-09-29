// A map with a kernel is still defined in Epsil: the kernel is that definition compiled. Each is
// held to its definition's answers over every small value of its carrier, and over a few
// values that aren't the carrier's, which both must decline.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { BinaryTreeParentArray, BinaryTreeUnrank, type BinTree, DyckPathUnrank } from "../../collections/src/families/kernels-extra.ts";
import { Factorial, PermutationUnrank } from "../../collections/src/families/kernels.ts";
import { CycleDecomposition } from "../../collections/src/families/permutations.ts";
import { evaluateDefinition, MAPS } from "../src/map.ts";

const MAX = 4;
const catalan = (n: number): number => (n === 0 ? 1 : ((4 * n - 2) * catalan(n - 1)) / (n + 1));
const upTo = <T>(count: (n: number) => number, unrank: (n: number, r: number) => T): T[] =>
  Array.from({ length: MAX + 1 }, (_, n) => Array.from({ length: count(n) }, (_, r) => unrank(n, r))).flat();

const list = (values: readonly unknown[]): unknown => ["List", ...values];
const nested = (tree: BinTree): unknown => (tree === 0 ? 0 : list([nested(tree[0]), nested(tree[1])]));
const trees = upTo(catalan, BinaryTreeUnrank);
const permutations = upTo(Factorial, PermutationUnrank);

/** Contents of every small value of each source carrier, then some that aren't one. */
const SUBJECTS: Record<string, unknown[]> = {
  binary_tree: trees.map(nested),
  binary_tree_parent_array: [...trees.map((t) => list(BinaryTreeParentArray(t))), list([2, 1]), list([0, 0]), list([2, 0, 1])],
  dyck_path: [...upTo(catalan, DyckPathUnrank).map(list), list([0, 1]), list([1, 1]), list([1, 0, 0, 1])],
  permutation: permutations.map(list),
  cycle_decomposition: [
    ...permutations.map((p) => list(CycleDecomposition(p).map(list))),
    list([list([2, 1])]),
    list([list([1]), list([1])]),
    list([list([2]), list([1])]),
  ],
};

const ce = new ComputeEngine();

for (const map of MAPS.filter((m) => m.kernel !== undefined)) {
  test(`${map.name} from ${map.from}: its kernel is its Epsil definition`, () => {
    expect(map.body, "a kernel needs the definition it compiles").toBeDefined();
    const subjects = SUBJECTS[map.from];
    expect(subjects, `no subjects for ${map.from}`).toBeDefined();
    for (const contents of subjects!)
      expect(map.kernel!(contents), JSON.stringify(contents)).toEqual(evaluateDefinition(ce, map, contents));
  });
}
