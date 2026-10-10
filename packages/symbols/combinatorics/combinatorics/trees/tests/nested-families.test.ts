// The nested tree families defined in Epsil (BinaryTrees, FullKAryTrees, OrderedTrees) against their TS
// kernels, which are their fast paths: the same count, the same element at the ranks asked, rank
// inverting unrank, and the same membership over members and near misses. The definitions are
// interpreted (a nested element has no compiled type), so the standard run samples ranks and
// DEEP_TESTS takes every member.

// unstable: the tests build an engine to run the families on.
import { ComputeEngine } from "@enumeratio/engine/unstable";
import { expect, test } from "vite-plus/test";
import { epsilKernelOn, type EpsilFamily, type FastKernel, kernelOn } from "../../collections/src/families/epsil.ts";
import { binaryTreesFast, fullKAryTreesFast, orderedTreesFast } from "../src/families/core.ts";
import { binaryTrees, fullKAryTrees } from "../src/families/kary-trees.ts";
import { orderedTrees } from "../src/families/ordered-trees.ts";

const DEEP = process.env.DEEP_TESTS === "1";
const ce = new ComputeEngine();

type Tree = number | Tree[];

/** Trees a step from `tree`: one leaf or node replaced, a child dropped or repeated. */
function neighbours(tree: Tree): Tree[] {
  if (!Array.isArray(tree)) return [[], [0], [0, 0], 1, -1];
  const out: Tree[] = [0, tree.slice(1), [...tree, tree[0] ?? 0], [], tree.length > 0 ? [tree] : [[]]];
  tree.forEach((child, i) => {
    for (const next of neighbours(child).slice(0, 3)) out.push(tree.map((c, j) => (i === j ? next : c)));
  });
  return out;
}

interface Reading {
  readonly family: EpsilFamily;
  readonly fast: FastKernel;
  readonly params: readonly number[][];
}

const READINGS: Record<string, Reading> = {
  BinaryTrees: { family: binaryTrees, fast: binaryTreesFast, params: [[0], [1], [2], [3], [5]] },
  FullKAryTrees: {
    family: fullKAryTrees,
    fast: fullKAryTreesFast,
    // k = 0 has no tree, k = 1 one chain.
    params: [
      [0, 0],
      [2, 0],
      [3, 1],
      [0, 2],
      [2, 2],
      [2, 3],
      [3, 3],
      [2, 4],
    ],
  },
  OrderedTrees: { family: orderedTrees, fast: orderedTreesFast, params: [[0], [1], [2], [3], [5]] },
};

for (const [head, { family, fast, params }] of Object.entries(READINGS)) {
  const kernel = epsilKernelOn(ce, family);
  for (const p of params) {
    test(`${head}(${p.join(", ")}) agrees with its TS kernel`, () => {
      const total = Number(fast.count(p));
      expect(kernel.count(p)).toBe(BigInt(total));
      const ranks =
        DEEP || total <= 6 ? Array.from({ length: total }, (_, r) => r) : [0, Math.floor(total / 2), total - 1];
      const members: Tree[] = [];
      for (const r of ranks) {
        const element = kernel.unrank(p, BigInt(r));
        expect(element).toEqual(fast.unrank(p, r));
        expect(kernel.valid(element, p)).toBe(true);
        expect(kernel.rank(element, p)).toBe(BigInt(r));
        members.push(element as Tree);
      }
      for (const near of members
        .slice(0, DEEP ? members.length : 2)
        .flatMap(neighbours)
        .slice(0, DEEP ? 400 : 8))
        expect([near, kernel.valid(near as never, p)]).toEqual([near, fast.valid(near, p)]);
    });
  }
}

test("no tree has fewer than one child per node", () => {
  const kernel = epsilKernelOn(ce, fullKAryTrees);
  expect(kernel.count([1, 0])).toBe(0n);
  // The TS kernel took the empty list for a tree of one node and no children.
  expect(kernel.valid([], [1, 0])).toBe(false);
  expect(fullKAryTreesFast.valid([], [1, 0])).toBe(false);
});

test("past 2^53 the count is exact and the stack walks decline", () => {
  const catalan = (n: number): bigint => {
    let c = 1n;
    for (let k = 0; k < n; k++) c = (c * BigInt(4 * k + 2)) / BigInt(k + 2);
    return c;
  };
  expect(epsilKernelOn(ce, binaryTrees).count([31])).toBe(catalan(31));
  expect(epsilKernelOn(ce, orderedTrees).count([31])).toBe(catalan(31));
  expect(epsilKernelOn(ce, fullKAryTrees).count([31, 2])).toBe(catalan(31));
  for (const [family, p] of [
    [binaryTrees, [31]],
    [orderedTrees, [31]],
    [fullKAryTrees, [31, 2]],
  ] as const)
    expect(() => epsilKernelOn(ce, family).unrank([...p], 0n)).toThrow(RangeError);
});

const catalan = (n: number): bigint => {
  let c = 1n;
  for (let k = 0; k < n; k++) c = (c * BigInt(4 * k + 2)) / BigInt(k + 2);
  return c;
};

test("at the 2^53 boundary the count is exact on both sides", () => {
  // C(30) is the last Catalan number a double holds, C(31) the first past it.
  const MAX = BigInt(Number.MAX_SAFE_INTEGER);
  expect(catalan(30) <= MAX && catalan(31) > MAX).toBe(true);
  for (const [family, fast, at, past] of [
    [binaryTrees, binaryTreesFast, [30], [31]],
    [orderedTrees, orderedTreesFast, [30], [31]],
    [fullKAryTrees, fullKAryTreesFast, [30, 2], [31, 2]],
  ] as const) {
    const kernel = epsilKernelOn(ce, family);
    expect(kernel.count([...at])).toBe(catalan(30));
    expect(fast.count([...at])).toBe(Number(catalan(30)));
    expect(kernel.count([...past])).toBe(catalan(31));
  }
});

test("membership past 2^53 is the fast path's, not the interpreter's", () => {
  for (const [family, fast, p] of [
    [binaryTrees, binaryTreesFast, [40]],
    [orderedTrees, orderedTreesFast, [40]],
    [fullKAryTrees, fullKAryTreesFast, [40, 2]],
  ] as const) {
    const calls: string[] = [];
    const kernel = kernelOn(ce, {
      ...family,
      fast: { ...fast, valid: (e, q) => (calls.push("valid"), fast.valid(e, q)) },
    });
    const member = fast.unrank([...p], 0);
    expect(kernel.count([...p]) > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
    const started = Date.now();
    expect(kernel.valid(member, [...p])).toBe(true);
    expect(kernel.valid(neighbours(member as Tree)[0] as never, [...p])).toBe(false);
    expect(calls).toEqual(["valid", "valid"]);
    // The interpreter takes seconds over a tree this size.
    expect(Date.now() - started).toBeLessThan(500);
  }
});
