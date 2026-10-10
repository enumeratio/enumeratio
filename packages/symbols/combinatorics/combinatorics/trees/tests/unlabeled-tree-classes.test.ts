// RootedUnlabeledTrees and UnlabeledFreeTrees defined in Epsil, against an independent generator
// of the same lists: no ranks, just every multiset of subtrees built and sorted into the order the
// families promise (heaviest subtree first; among subtrees of one weight, the multiset of trees
// in colex order of its digits, then the lighter subtrees). Counts against Otter's recurrences
// in bigint; membership over every tree and every level sequence near them.

import { readFileSync } from "node:fs";
import { collectMessages } from "@enumeratio/engine";
import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { epsilKernelOn } from "../../collections/src/families/epsil.ts";
import { declareCombinatorics } from "../../src/index.ts";
import { rootedUnlabeledTrees, unlabeledFreeTrees } from "../src/families/unlabeled-tree-classes.ts";

// DEEP_TESTS=1 goes further: rooted to 16 nodes and free to 18, about two minutes.
const DEEP = process.env.DEEP_TESTS === "1";
const ce = bareEngine();
const rooted = epsilKernelOn(ce, rootedUnlabeledTrees);
const free = epsilKernelOn(ce, unlabeledFreeTrees);

type Tree = number[];

/** The k-multisets of 0..types − 1 as nondecreasing lists, in colex order of a_j + j − 1: the
 *  largest entry decides first. */
function multisets(types: number, k: number): number[][] {
  const all: number[][] = [];
  const grow = (prefix: number[]): void => {
    if (prefix.length === k) {
      all.push(prefix);
      return;
    }
    for (let a = prefix.at(-1) ?? 0; a < types; a++) grow([...prefix, a]);
  };
  grow([]);
  const key = (m: number[]): number[] => m.toReversed();
  return all.toSorted((x, y) => {
    const [a, b] = [key(x), key(y)];
    for (let i = 0; i < k; i++) if (a[i] !== b[i]) return a[i] - b[i];
    return 0;
  });
}

const treesOf = new Map<number, Tree[]>();
/** The rooted trees of w nodes, as level sequences, in the families' order. */
function rootedTrees(w: number): Tree[] {
  if (w < 1) return [];
  let found = treesOf.get(w);
  if (found === undefined) {
    found = w === 1 ? [[0]] : children(w - 1, w - 1).map(assemble);
    treesOf.set(w, found);
  }
  return found;
}

/** A root over subtrees: each subtree's depths one deeper. */
const assemble = (subtrees: Tree[]): Tree => [0, ...subtrees.flatMap((t) => t.map((d) => d + 1))];

/** The multisets of subtrees weighing `rem`, none over `cap`: by how many weigh `cap` (fewest
 *  first), then which multiset of that weight's trees, the lighter subtrees varying fastest. */
const childrenOf = new Map<string, Tree[][]>();
function children(rem: number, cap: number): Tree[][] {
  if (rem === 0) return [[]];
  if (cap === 0) return [];
  const key = `${rem},${cap}`;
  let found = childrenOf.get(key);
  if (found === undefined) {
    const trees = rootedTrees(cap);
    found = [];
    for (let k = 0; k * cap <= rem; k++) {
      const rests = children(rem - k * cap, cap - 1);
      for (const picked of multisets(trees.length, k))
        for (const rest of rests) found.push([...picked.map((t) => trees[t]), ...rest]);
    }
    childrenOf.set(key, found);
  }
  return found;
}

/** The subtrees of a root's level sequence, each as its own level sequence. */
function subtreesOf(tree: Tree): Tree[] {
  const out: Tree[] = [];
  for (const depth of tree.slice(1)) {
    if (depth === 1) out.push([0]);
    else out.at(-1)!.push(depth - 1);
  }
  return out;
}

/** The free trees of n nodes, rooted at a centroid, in the families' order. */
function freeTrees(n: number): Tree[] {
  if (n < 1) return [];
  if (n === 1) return [[0]];
  const half = Math.floor(n / 2);
  if (n % 2 === 1) return children(n - 1, half).map(assemble);
  const halves = rootedTrees(half);
  const out = children(n - 1, half - 1).map(assemble);
  // Two centroids: the tree is its two halves a ≤ b, listed by a and then b.
  for (let a = 0; a < halves.length; a++)
    for (let b = a; b < halves.length; b++) out.push(assemble([halves[a], ...subtreesOf(halves[b])]));
  return out;
}

const READINGS = [
  { name: "RootedUnlabeledTrees", kernel: rooted, generate: rootedTrees, sizes: DEEP ? 16 : 12 },
  { name: "UnlabeledFreeTrees", kernel: free, generate: freeTrees, sizes: DEEP ? 18 : 15 },
] as const;

// The order the families had as TS kernels, dumped from them before they were replaced: the
// generator above must give it, and so the Epsil, which is held to the generator, does too.
const OLD = JSON.parse(readFileSync(new URL("./golden/old-unlabeled-trees.json", import.meta.url), "utf8")) as Record<
  string,
  Record<string, string[]>
>;

for (const { name, generate } of READINGS) {
  test(`${name}: the generator lists the trees in the order the TS kernel did`, () => {
    const sizes = Object.keys(OLD[name]).map(Number);
    expect(sizes.length).toBeGreaterThanOrEqual(11);
    for (const n of sizes)
      expect(generate(n).map((tree) => tree.map((d) => d.toString(36)).join(""))).toEqual(OLD[name][n]);
  });
}

for (const { name, kernel, generate, sizes } of READINGS) {
  test(`${name} is every tree in the generator's order, and rank and unrank invert`, () => {
    for (let n = 0; n <= sizes; n++) {
      const expected = generate(n);
      expect([n, kernel.count([n])]).toEqual([n, BigInt(expected.length)]);
      expected.forEach((tree, r) => {
        expect([n, r, kernel.unrank([n], BigInt(r))]).toEqual([n, r, tree]);
        expect([n, r, kernel.rank(tree, [n])]).toEqual([n, r, BigInt(r)]);
        expect([n, tree, kernel.valid(tree, [n])]).toEqual([n, tree, true]);
      });
    }
  });
}

test("the counts are A000081 and A000055", () => {
  expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => rooted.count([n]))).toEqual(
    [1, 1, 2, 4, 9, 20, 48, 115, 286, 719].map(BigInt),
  );
  expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => free.count([n]))).toEqual(
    [1, 1, 1, 2, 3, 6, 11, 23, 47, 106].map(BigInt),
  );
  expect([0, -3].map((n) => [rooted.count([n]), free.count([n])])).toEqual([
    [0n, 0n],
    [0n, 0n],
  ]);
});

/** a(n) of A000081, by the recurrence a(n + 1) = Σ_k (Σ_{d | k} d a(d)) a(n − k + 1) / n. */
function rootedCounts(upTo: number): bigint[] {
  const a: bigint[] = [0n, 1n];
  for (let n = 1; n < upTo; n++) {
    let sum = 0n;
    for (let k = 1; k <= n; k++) {
      let sigma = 0n;
      for (let d = 1; d <= k; d++) if (k % d === 0) sigma += BigInt(d) * a[d];
      sum += sigma * a[n - k + 1];
    }
    a.push(sum / BigInt(n));
  }
  return a;
}
/** Otter: t(n) = a(n) − Σ_{i ≤ n/2} a(i) a(n − i), plus a(n/2) (a(n/2) + 1)/2 for n even. */
const freeCount = (a: bigint[], n: number): bigint => {
  let t = a[n];
  for (let i = 1; i <= Math.floor(n / 2); i++) t -= a[i] * a[n - i];
  if (n % 2 === 0) t += (a[n / 2] * (a[n / 2] + 1n)) / 2n;
  return t;
};

test("a count a double holds is exact, up to 2^53; past it the count declines", () => {
  const a = rootedCounts(70);
  const MAX = BigInt(Number.MAX_SAFE_INTEGER);
  let exactRooted = 0;
  let exactFree = 0;
  for (let n = 1; n < 60; n++) {
    for (const [kernel, want] of [
      [rooted, a[n]],
      [free, freeCount(a, n)],
    ] as const) {
      if (want <= MAX) {
        expect([n, kernel.count([n])]).toEqual([n, want]);
        if (kernel === rooted) exactRooted = n;
        else exactFree = n;
      } else expect(() => kernel.count([n])).toThrow(RangeError);
    }
  }
  // The edge of 2^53, so the test really straddles it.
  expect([exactRooted, exactFree]).toEqual([39, 43]);
});

test("past 2^53 there is no count, and so no element to rank or unrank", () => {
  expect(() => rooted.unrank([40], 0n)).toThrow(RangeError);
  expect(() => free.unrank([44], 0n)).toThrow(RangeError);
  const tree = rooted.unrank([39], 4_000_000_000_000_000n);
  expect(rooted.valid(tree, [39])).toBe(true);
  expect(rooted.rank(tree, [39])).toBe(4_000_000_000_000_000n);
  const big = free.unrank([43], 2_000_000_000_000_000n);
  expect(free.valid(big, [43])).toBe(true);
  expect(free.rank(big, [43])).toBe(2_000_000_000_000_000n);
});

test("the first, middle and last trees of a large fiber round-trip", () => {
  for (const [kernel, n] of [
    [rooted, 30],
    [free, 36],
  ] as const) {
    const total = kernel.count([n]) as bigint;
    for (const r of [0n, 1n, total / 3n, total / 2n, total - 2n, total - 1n]) {
      const tree = kernel.unrank([n], r);
      expect(tree).toHaveLength(n);
      expect(kernel.valid(tree, [n])).toBe(true);
      expect(kernel.rank(tree, [n])).toBe(r);
    }
  }
});

/** Every level sequence of n nodes: depth 0 first, each next at most one deeper. */
function levelSequences(n: number): Tree[] {
  const out: Tree[] = [];
  const grow = (seq: Tree): void => {
    if (seq.length === n) {
      out.push(seq);
      return;
    }
    for (let d = 1; d <= seq.at(-1)! + 1; d++) grow([...seq, d]);
  };
  if (n >= 1) grow([0]);
  return out;
}

/** The level sequences of the size and of those either side of it. */
const nearby = (n: number): Tree[] => [n - 1, n, n + 1].filter((m) => m >= 1).flatMap(levelSequences);

test("membership over every level sequence of nearby sizes, and words that are none", () => {
  for (const { kernel, generate, name } of READINGS) {
    let rejected = 0;
    for (let n = 1; n <= 8; n++) {
      const known = new Set(generate(n).map((t) => JSON.stringify(t)));
      for (const tree of nearby(n)) {
        const member = known.has(JSON.stringify(tree));
        expect([name, n, tree, kernel.valid(tree, [n])]).toEqual([name, n, tree, member]);
        if (!member) rejected++;
      }
      // Not level sequences at all: no root at 0, a depth jumped, a negative, a repeat of the root.
      for (const word of [[], [1], [0, 2], [0, 1, 3], [1, 2, 3], [0, -1], [0, 0], [0, 1, 0], [0, 1, 1.5]])
        expect([name, n, word, kernel.valid(word as number[], [n])]).toEqual([name, n, word, false]);
    }
    expect(rejected).toBeGreaterThan(100);
  }
});

/** The level sequence of a root over a chain of each of `lengths` nodes. */
const chains = (...lengths: number[]): Tree => [
  0,
  ...lengths.flatMap((length) => Array.from({ length }, (_, i) => i + 1)),
];

/** A chain of `length` nodes, with `extra` more leaves beside its last node. */
const chainWithLeaves = (length: number, extra: number): Tree => [
  ...Array.from({ length }, (_, i) => i),
  ...Array.from({ length: extra }, () => length - 1),
];

/** A tree's level sequence as the engine takes it, bare or in its carrier. */
const list = (...xs: number[]) => ["List", ...xs];
const carried = (carrier: string, ...xs: number[]) => [carrier, list(...xs)];

const engine = bareEngine();
declareCombinatorics(engine);
const run = (expr: unknown) => engine.box(expr as never).evaluate().json;
const element = (x: unknown, family: unknown) => run(["Element", x, family]);
const decided = (x: unknown) => x === "True" || x === "False";

test("T(40) is the first count past 2^53, so equal subtrees of 40 nodes can't be ordered by rank", () => {
  expect(() => rooted.count([39])).not.toThrow();
  expect(() => rooted.count([40])).toThrow(RangeError);
});

test("membership past 2^53: equal subtrees that are one sequence tie, and others decline", () => {
  const twins = chains(40, 40);
  for (const [kernel, name] of [
    [rooted, "RootedUnlabeledTrees"],
    [free, "UnlabeledFreeTrees"],
  ] as const) {
    // Two equal chains of 40: the same sequence, so a valid tie, found without ranks.
    expect(kernel.valid(twins, [81])).toBe(true);
    expect(element(list(...twins), [name, 81])).toBe("True");
    // Two subtrees of 40 that differ: ordering them takes ranks past what a double holds.
    const differ = [0, ...chainWithLeaves(40, 0).map((d) => d + 1), ...chainWithLeaves(39, 1).map((d) => d + 1)];
    expect(differ).toHaveLength(81);
    expect(() => kernel.valid(differ, [81])).toThrow(RangeError);
    expect(decided(element(list(...differ), [name, 81]))).toBe(false);
    // Whatever else is wrong is wrong: subtrees out of order by weight, whatever the ties.
    expect(kernel.valid(chains(39, 40, 40), [120])).toBe(false);
  }
  // The halves of a free tree with two centroids, 40 nodes each: the same sequence or not.
  const halves = [0, ...chainWithLeaves(40, 0).map((d) => d + 1), ...chainWithLeaves(38, 1).map((d) => d + 1)];
  expect(halves).toHaveLength(80);
  expect(() => free.valid(halves, [80])).toThrow(RangeError);
  expect(free.valid(chains(40, 39), [80])).toBe(true);
  expect(element(list(...chains(40, 39)), ["UnlabeledFreeTrees", 80])).toBe("True");
  expect(decided(element(list(...halves), ["UnlabeledFreeTrees", 80]))).toBe(false);
  // Unequal subtrees, however heavy, and equal ones under 40 nodes, are ordered exactly.
  expect(rooted.valid(chains(60, 39), [100])).toBe(true);
  expect(rooted.valid(chains(39, 39), [79])).toBe(true);
  expect(rooted.valid(chains(39, 60), [100])).toBe(false);
  expect(free.valid(chains(39, 39), [79])).toBe(true);
  expect(free.valid(chains(60, 39), [100])).toBe(false);
});

test("Element answers at sizes past the count, as far as a table is worth building", () => {
  // Rooted from n = 40 and free from n = 44 have no count, but a tree is still a tree.
  expect(element(list(0), ["RootedUnlabeledTrees", 5000])).toBe("False");
  expect(element(list(0, 1, 2), ["UnlabeledFreeTrees", 5000])).toBe("False");
  expect(element(list(...chains(60, 39)), ["RootedUnlabeledTrees", 100])).toBe("True");
  expect(element(carried("RootedUnlabeledTree", ...chains(60, 39)), ["RootedUnlabeledTrees", 100])).toBe("True");
  expect(element(list(...chains(39, 60)), ["RootedUnlabeledTrees", 100])).toBe("False");
  expect(element(list(...chains(100)), ["RootedUnlabeledTrees", 101])).toBe("True");
  // Free trees of 44..79 nodes: the centroid roots, kids heaviest first.
  for (const n of [44, 50, 60, 79]) {
    const a = Math.floor((n - 1) / 3);
    const lengths = [a, a, n - 1 - 2 * a].toSorted((x, y) => y - x);
    expect(lengths.every((l) => l <= Math.floor(n / 2))).toBe(true);
    const name = "UnlabeledFreeTrees";
    expect(element(list(...chains(...lengths)), [name, n])).toBe("True");
    expect(element(carried("UnlabeledFreeTree", ...chains(...lengths)), [name, n])).toBe("True");
    expect(element(list(...chains(...lengths.toReversed())), [name, n])).toBe(
      lengths[0] === lengths[2] ? "True" : "False",
    );
    expect(element(list(...chains(n - 1)), [name, n])).toBe("False");
    expect(run(["Count", [name, n]])).toEqual(["Count", [name, n]]);
  }
  // Too long to try: neither True nor False, and cheaply so.
  const t0 = performance.now();
  expect(decided(element(list(...chains(500)), ["RootedUnlabeledTrees", 501]))).toBe(false);
  expect(performance.now() - t0).toBeLessThan(1000);
});

test("a count past 2^53, and a sequence of the wrong length, are answered without a table", () => {
  const t0 = performance.now();
  for (const kernel of [rooted, free]) {
    expect(() => kernel.count([5000])).toThrow(RangeError);
    expect(kernel.valid([0], [5000])).toBe(false);
    expect(kernel.valid([0, 1, 3], [3])).toBe(false);
    expect(kernel.rank([0], [5000])).toBe(-1n);
  }
  expect(performance.now() - t0).toBeLessThan(1000);
});

test("a rank outside the fiber, and a size with no trees, decline", () => {
  for (const [kernel, n] of [
    [rooted, 5],
    [free, 6],
  ] as const) {
    const total = kernel.count([n]) as bigint;
    for (const r of [total, total + 1n, -1n, -total]) expect(() => kernel.unrank([n], r)).toThrow(RangeError);
    expect(kernel.unrank([n], total - 1n)).toHaveLength(n);
    expect(kernel.unrank([n], 0n)).toHaveLength(n);
  }
  for (const kernel of [rooted, free])
    for (const n of [0, -1, -7]) expect(() => kernel.unrank([n], 0n)).toThrow(RangeError);
});

test("the families answer Element the same as membership", () => {
  expect(element(list(0, 1, 2, 1), ["RootedUnlabeledTrees", 4])).toBe("True");
  expect(element(list(0, 1, 1, 2), ["RootedUnlabeledTrees", 4])).toBe("False");
  expect(element(carried("RootedUnlabeledTree", 0, 1, 2, 1), ["RootedUnlabeledTrees", 4])).toBe("True");
  expect(element(carried("RootedUnlabeledTree", 0, 1, 1, 2), ["RootedUnlabeledTrees", 4])).toBe("False");
  expect(element(list(0, 1, 2, 3), ["RootedUnlabeledTrees", 3])).toBe("False");
  // The path rooted at its end is a rooted tree but not a free one, which is rooted at its centroid.
  const members = freeTrees(5);
  expect(members).toContainEqual([0, 1, 2, 1, 2]);
  expect(element(list(...members[0]), ["UnlabeledFreeTrees", 5])).toBe("True");
  expect(element(list(0, 1, 2, 1, 2), ["UnlabeledFreeTrees", 5])).toBe("True");
  expect(element(list(0, 1, 2, 3, 4), ["UnlabeledFreeTrees", 5])).toBe("False");
  expect(element(carried("UnlabeledFreeTree", 0, 1, 2, 3, 4), ["UnlabeledFreeTrees", 5])).toBe("False");
  expect(element(carried("UnlabeledFreeTree", 0, 1, 2, 1, 2), ["UnlabeledFreeTrees", 5])).toBe("True");
  // No family at n = 0, and no tree at a size its length doesn't fit.
  expect(element(list(0), ["RootedUnlabeledTrees", 0])).toBe("False");
  expect(element(list(0), ["UnlabeledFreeTrees", 2])).toBe("False");
  expect(element(list(0), ["UnlabeledFreeTrees", -1])).not.toBe("True");
});

test("At and Count on the engine give the generator's trees and counts", () => {
  const depthsAt = (family: unknown, i: number) => {
    const [, [, ...depths]] = run(["At", family, i]) as unknown as [string, ["List", ...number[]]];
    return depths;
  };
  rootedTrees(5).forEach((tree, i) => expect(depthsAt(["RootedUnlabeledTrees", 5], i + 1)).toEqual(tree));
  freeTrees(6).forEach((tree, i) => expect(depthsAt(["UnlabeledFreeTrees", 6], i + 1)).toEqual(tree));
  expect(run(["Count", ["RootedUnlabeledTrees", 30]])).toBe(354426847597);
  expect(run(["Count", ["UnlabeledFreeTrees", 43]])).toBe(Number(freeCount(rootedCounts(70), 43)));
  // Past 2^53 the count is unknown, not rounded.
  expect(run(["Count", ["RootedUnlabeledTrees", 40]])).toEqual(["Count", ["RootedUnlabeledTrees", 40]]);
  expect(run(["Count", ["UnlabeledFreeTrees", 44]])).toEqual(["Count", ["UnlabeledFreeTrees", 44]]);
});

test("a call walks a step a node and answers; iterating the whole family is gated by its count", () => {
  const iterate = (family: unknown): { items: number; texts: string[] } => {
    const { value, messages } = collectMessages(engine, () =>
      Array.from((engine.box(family as never) as unknown as { each: () => Iterable<unknown> }).each()),
    );
    return { items: value.length, texts: messages.map((m) => (m as { text?: string }).text ?? "") };
  };
  // Small enough to enumerate, so every tree comes out.
  expect(iterate(["RootedUnlabeledTrees", 6])).toEqual({ items: 20, texts: [] });
  expect(iterate(["UnlabeledFreeTrees", 9]).items).toBe(47);
  // 354,426,847,597 trees: one is fine (At), all of them are not (Take, Map, Table, Filter go through the same gate).
  const rootedBig = iterate(["RootedUnlabeledTrees", 30]);
  expect(rootedBig.items).toBe(0);
  expect(rootedBig.texts.join(" ")).toContain(
    "RootedUnlabeledTrees(30) would enumerate about 354,426,847,597 elements",
  );
  expect(iterate(["UnlabeledFreeTrees", 30]).texts.join(" ")).toContain("14,830,871,802");
  expect(run(["At", ["RootedUnlabeledTrees", 30], 123_456_789])).toMatchObject([
    "RootedUnlabeledTree",
    ["List", 0, ...Array.from({ length: 29 }, () => expect.any(Number))],
  ]);
});
