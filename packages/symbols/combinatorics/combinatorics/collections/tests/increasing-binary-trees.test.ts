// IncreasingBinaryTrees defined in Epsil against its TS kernel (its fast path): the same count, the
// same element at the ranks asked, rank inverting unrank, and the same membership over members and
// near misses. The definition is interpreted (a nested element has no compiled type), so the
// standard run samples ranks and DEEP_TESTS takes every member.

// unstable: the tests build an engine to run the family on.
import { ComputeEngine } from "@enumeratio/engine/unstable";
import { expect, test } from "vite-plus/test";
import { epsilKernelOn, kernelOn } from "../src/families/epsil.ts";
import { increasingBinaryTrees } from "../src/families/increasing-binary-trees.ts";
import { increasingBinaryTreesFast as fast } from "../src/families/tableaux-trees.ts";

const DEEP = process.env.DEEP_TESTS === "1";
const kernel = epsilKernelOn(new ComputeEngine(), increasingBinaryTrees);

type Tree = number | Tree[];

/** Trees a step from `tree`: a label changed, a subtree dropped, swapped or turned into a leaf. */
function neighbours(tree: Tree): Tree[] {
  if (!Array.isArray(tree)) return [[1, 0, 0], 1, -1];
  const [label, left, right] = tree as [Tree, Tree, Tree];
  return [
    0,
    [label, right, left],
    [label, left],
    [label, left, right, 0],
    [typeof label === "number" ? label + 1 : 1, left, right],
    [typeof label === "number" ? label - 1 : 1, left, right],
    [label, 0, right],
    [label, left, 0],
    [[label], left, right],
    ...neighbours(left)
      .slice(0, 2)
      .map((next): Tree => [label, next, right]),
    ...neighbours(right)
      .slice(0, 2)
      .map((next): Tree => [label, left, next]),
  ];
}

for (const n of [0, 1, 2, 3, 4]) {
  test(`IncreasingBinaryTrees(${n}) agrees with its TS kernel`, () => {
    const total = Number(fast.count([n]));
    expect(kernel.count([n])).toBe(BigInt(total));
    const ranks =
      DEEP || total <= 6 ? Array.from({ length: total }, (_, r) => r) : [0, Math.floor(total / 2), total - 1];
    const members: Tree[] = [];
    for (const r of ranks) {
      const element = kernel.unrank([n], BigInt(r));
      expect(element).toEqual(fast.unrank([n], r));
      expect(kernel.valid(element, [n])).toBe(true);
      expect(kernel.rank(element, [n])).toBe(BigInt(r));
      members.push(element as Tree);
    }
    for (const near of members
      .slice(0, DEEP ? members.length : 2)
      .flatMap(neighbours)
      .slice(0, DEEP ? 400 : 8))
      expect([near, kernel.valid(near as never, [n])]).toEqual([near, fast.valid(near, [n])]);
  });
}

test("a label out of heap order, repeated or out of range is not a tree", () => {
  for (const [tree, n] of [
    [[2, [1, 0, 0], 0], 2],
    [[1, [1, 0, 0], 0], 2],
    [[1, [3, 0, 0], 0], 2],
    [[1, [2, 0, 0], 0], 1],
  ] as const) {
    expect(kernel.valid(tree as never, [n])).toBe(false);
    expect(fast.valid(tree, [n])).toBe(false);
  }
});

test("membership at a huge n is settled by the tree, not sized by n", () => {
  for (const n of [1e8, 1e9, 3e9]) expect(fast.valid([1, [2, 0, 0], 0], [n])).toBe(false);
});

test("past 2^53 the count is exact and the walks decline", () => {
  expect(kernel.count([20])).toBe(2432902008176640000n);
  expect(() => kernel.unrank([20], 0n)).toThrow(RangeError);
});

test("at the 2^53 boundary the count is exact on both sides, and membership is the fast path's", () => {
  // 18! is the last factorial a double holds, 19! the first past it.
  expect(kernel.count([18])).toBe(6402373705728000n);
  expect(fast.count([18])).toBe(6402373705728000);
  expect(kernel.count([19])).toBe(121645100408832000n);
  const calls: string[] = [];
  const quick = kernelOn(new ComputeEngine(), {
    ...increasingBinaryTrees,
    fast: { ...fast, valid: (e, q) => (calls.push("valid"), fast.valid(e, q)) },
  });
  const member = fast.unrank([20], 0);
  const started = Date.now();
  expect(quick.valid(member, [20])).toBe(true);
  expect(quick.valid([2, member, 0], [20])).toBe(false);
  expect(calls).toEqual(["valid", "valid"]);
  expect(Date.now() - started).toBeLessThan(500);
});
