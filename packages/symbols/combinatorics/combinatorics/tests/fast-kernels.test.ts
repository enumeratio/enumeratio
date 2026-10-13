// A family's `fast` path is a hand-written reading that answers ahead of its Epsil definitions
// while the fiber's count is a safe integer. The definitions are the meaning, so every fast
// family is held to them here: over a sampled grid of params, the fast kernel and the kernel
// built from Epsil alone agree on count, unrank, rank and valid (members and near misses).

import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { gesselAv1234 } from "../collections/tests/av1234.ts";
import { COMPILED_FAMILIES } from "../collections/src/families/compiled-families.generated.js";
import {
  type EpsilFamily,
  type FastKernel,
  epsilKernelOn,
  FAST_LIMIT,
  familyHash,
  isEpsilFamily,
  kernelOn,
} from "../collections/src/families/epsil.ts";
import { allFamilies } from "../collections/src/families/index.ts";
import {
  Binomial,
  CompositionCount,
  CompositionFromMask,
  CompositionRank,
} from "../collections/src/families/kernels-combinatorics.ts";
import {
  CatalanNumber,
  CyclicPermutationCount,
  CyclicPermutationRank,
  CyclicPermutationUnrank,
  DerangementCount,
  DerangementRank,
  DerangementUnrank,
  InvolutionCount,
  InvolutionRank,
  InvolutionUnrank,
  GrayCodeSubsetRank,
  GrayCodeSubsetUnrank,
  KSubsetCount,
  KSubsetRank,
  KSubsetUnrank,
  SubsetCount,
  SubsetRank,
  SubsetUnrank,
  TupleRank,
  TupleUnrank,
} from "../collections/src/families/kernels-extra.ts";
import { floorDiv, ipow, modRank, PermutationRank, PermutationUnrank } from "../collections/src/families/kernels.ts";
import type { Element, NumberKernel } from "../collections/src/families/types.ts";
import { PhylogeneticTreeUnrank } from "../trees/src/families/unlabeled-trees.ts";

const DEEP = process.env.DEEP_TESTS === "1";
const ce = bareEngine();
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
// How far each axis is scanned for the edge of the fast path.
const SCAN = 90;

const fastFamilies = allFamilies.filter(isEpsilFamily).filter((family) => family.fast !== undefined);

/** The fiber the family's fast kernel counts at `p`, when that is a safe integer. */
function countOf(family: EpsilFamily, p: number[]): bigint | undefined {
  try {
    const total = family.fast!.count(p);
    if (typeof total === "bigint") return total <= MAX_SAFE ? total : undefined;
    return typeof total === "number" && Number.isSafeInteger(total) ? BigInt(total) : undefined;
  } catch {
    return undefined;
  }
}

/** Walking `at(x)` for x = 0, 1, …: the last x whose fiber is a safe integer, and the first one
 *  after it whose fiber is not (past 2^53). None when the walk ends before the fiber passes 2^32,
 *  as along an axis where the other param keeps it small. */
function edgeAlong(
  family: EpsilFamily,
  at: (x: number) => number[],
): { below: number[]; above?: number[] } | undefined {
  let below: number[] | undefined;
  for (let x = 0; x <= SCAN; x++) {
    const p = at(x);
    if (countOf(family, p) !== undefined) below = p;
    else if (below !== undefined) return { below, above: p };
  }
  return below !== undefined && countOf(family, below)! > 2n ** 32n ? { below } : undefined;
}

// Nested elements have no compiled type, so these families' definitions are interpreted, a few
// hundred milliseconds an operation: the standard run takes small params and a few ranks of each,
// and DEEP_TESTS the full grid. Their own tests (trees/tests, collections/tests) check more.
const INTERPRETED = new Set([
  "BinaryTrees",
  "FullKAryTrees",
  "OrderedTrees",
  "IncreasingBinaryTrees",
  "StandardTableauPairs",
]);
const interpreted = (family: EpsilFamily): boolean => !DEEP && INTERPRETED.has(family.head);

// Families whose fast path stops at a table limit, a size or two past what Epsil does quickly, not at
// 2^53: the edge scan would find the limit, and Epsil takes seconds a call there (minutes, past it).
const NO_EDGE = new Set([
  "SkewStandardTableaux",
  // Vexillary's table is 2^n states: Epsil takes minutes at the first size past 2^53 (held to it up to n = 14
  // in permutations/tests/vexillary-count.test.ts). Separable's compiled table leaves the safe integers
  // a size before its count does, and Epsil declines there.
  "VexillaryPermutations",
  "SeparablePermutations",
]);

const grids = new Map<string, { grid: number[][]; above: number[][] }>();

/** The params to try: small ones, and the edges where the fast path stops answering: params whose
 *  fiber is the last at most 2^53 along an axis (`grid`), and the first past it (`above`). Epsil
 *  is slow on long elements, so the standard run takes the edge with the smallest params. */
function paramGrid(family: EpsilFamily): { grid: number[][]; above: number[][] } {
  const cached = grids.get(family.head);
  if (cached !== undefined) return cached;
  const small = DEEP ? [0, 1, 2, 3, 4, 5, 6, 8, 10, 13] : interpreted(family) ? [0, 1, 2] : [0, 1, 2, 3, 5, 8];
  const walks: ((x: number) => number[])[] = [];
  if (family.paramCount === 1) walks.push((n) => [n]);
  else
    for (const fixed of [1, 2, 3, 5, 8, 16, 32])
      walks.push(
        (n) => [fixed, n],
        (n) => [n, fixed],
      );
  const size = (p: number[]): number => p.reduce((sum, x) => sum + x, 0);
  const edges = (NO_EDGE.has(family.head) ? [] : walks)
    .map((at) => edgeAlong(family, at))
    .filter((edge) => edge !== undefined)
    .toSorted((a, b) => size(a.below) - size(b.below))
    .slice(0, DEEP ? 4 : interpreted(family) ? 0 : 1);
  const grid: number[][] =
    family.paramCount === 1 ? small.map((n) => [n]) : small.flatMap((a) => small.map((b) => [a, b]));
  const above: number[][] = [];
  for (const edge of edges) {
    grid.push(edge.below);
    if (edge.above !== undefined) above.push(edge.above);
  }
  const unique = (list: number[][]): number[][] => [...new Map(list.map((p) => [p.join(","), p])).values()];
  const found = { grid: unique(grid).filter((p) => countOf(family, p) !== undefined), above: unique(above) };
  grids.set(family.head, found);
  return found;
}

// A fixed pseudo-random stream, so a failure repeats.
let seed = 0x2545f4914f6cdd1dn;
function random(below: bigint): bigint {
  seed = (seed * 6364136223846793005n + 1442695040888963407n) % 2n ** 64n;
  return (seed >> 11n) % below;
}

/** Ranks of a fiber of `total`: all when small, else both ends, the middle and pseudo-random ones. */
function ranksOf(total: bigint, few = false): bigint[] {
  if (few && total > 6n) return [...new Set([0n, total / 2n, total - 1n])];
  if (total <= (DEEP ? 120n : 24n)) return Array.from({ length: Number(total) }, (_, i) => BigInt(i));
  const ranks = new Set<bigint>([0n, 1n, total - 2n, total - 1n, total / 2n]);
  for (let i = 0; i < (DEEP ? 24 : 3); i++) ranks.add(random(total));
  if (DEEP) {
    for (const r of [2n, total - 3n, total / 3n]) ranks.add(r);
    for (let i = 1n; i < 12n; i++) ranks.add((i * (total - 1n)) / 12n);
  }
  return [...ranks].toSorted((a, b) => (a < b ? -1 : 1));
}

const clone = (e: Element): Element => (Array.isArray(e) ? (e.map(clone) as Element) : e);

/** Elements a step from `member`: a leaf moved either way, an entry dropped, repeated or swapped. */
function mutations(member: Element): Element[] {
  if (!Array.isArray(member)) return [member + 1, member - 1];
  const out: Element[] = [];
  const leaves: (number | string)[][] = [];
  const walk = (node: Element, path: (number | string)[]): void => {
    if (Array.isArray(node)) node.forEach((child, i) => walk(child as Element, [...path, i]));
    else leaves.push(path);
  };
  walk(member, []);
  const step = Math.max(1, Math.floor(leaves.length / 8));
  for (let i = 0; i < leaves.length; i += step)
    for (const delta of [1, -1]) {
      const copy = clone(member) as unknown[];
      const path = leaves[i] as number[];
      let parent = copy;
      for (const index of path.slice(0, -1)) parent = parent[index] as unknown[];
      (parent[path.at(-1)!] as number) += delta;
      out.push(copy as Element);
    }
  const list = member as unknown[];
  out.push(list.slice(0, -1) as Element, [...list, list[0]] as Element, list.toReversed() as Element);
  if (list.length > 1) out.push([list[1], list[0], ...list.slice(2)] as Element);
  return out;
}

const labelled = (family: EpsilFamily, p: number[]): string => `${family.head}(${p.join(", ")})`;

test("some families carry a fast path, and a kernel says so", () => {
  expect(fastFamilies.length).toBeGreaterThan(20);
  const [family] = fastFamilies;
  expect(kernelOn(ce, family).fast).toBe(true);
  expect(epsilKernelOn(ce, family).fast).toBeUndefined();
  expect(kernelOn(ce, family, COMPILED_FAMILIES, { fast: false }).fast).toBeUndefined();
});

test("a fast path is not part of the definitions' hash", () => {
  for (const family of fastFamilies) {
    const { fast: _, ...bare } = family;
    expect(familyHash(family)).toBe(familyHash(bare as EpsilFamily));
  }
});

// A family may carry a fast count alone, leaving unrank, rank and membership to Epsil.
const countFamilies = allFamilies.filter(isEpsilFamily).filter((family) => family.fastCount !== undefined);

test("some families carry a fast count alone, and a kernel says so", () => {
  expect(countFamilies.length).toBeGreaterThan(0);
  for (const family of countFamilies) {
    expect(family.fast).toBeUndefined();
    expect(kernelOn(ce, family).fast).toBe(true);
    expect(epsilKernelOn(ce, family).fast).toBeUndefined();
    const { fastCount: _, ...bare } = family;
    expect(familyHash(family)).toBe(familyHash(bare as EpsilFamily));
  }
});

const EXTRA_PAST: Record<string, number[][]> = {
  BoxedPlanePartitions: [
    [2, 30, 30],
    [30, 2, 30],
    [30, 30, 2],
  ],
  SytTwoRow: [[58]],
  SytTwoColumn: [[58]],
  AlternatingSignMatrices: [[14]],
  NonDecreasingParkingFunctions: [[32]],
  PermutationsAvoiding123: [[36]],
  PermutationsAvoiding132: [[37]],
  PermutationsAvoiding213: [[38]],
  PermutationsAvoiding231: [[40]],
  PermutationsAvoiding312: [[41]],
  PermutationsAvoiding321: [[36]],
};

/** The partitions of n, parts descending. */
const partitionsOf = (n: number, most = n): number[][] =>
  n === 0
    ? [[]]
    : Array.from({ length: Math.min(n, most) }, (_, i) => i + 1).flatMap((part) =>
        partitionsOf(n - part, part).map((rest) => [part, ...rest]),
      );

/** The semistandard tableaux of n cells with entries 1 … k: Σ over shapes of Π (k + content)/hook, each exact. */
function semistandardByShapes([n, k]: number[]): bigint {
  let total = 0n;
  for (const shape of partitionsOf(n)) {
    if (shape.length > k) continue;
    let [up, down] = [1n, 1n];
    shape.forEach((length, r) => {
      for (let c = 0; c < length; c++) {
        const legs = shape.filter((l) => l > c).length - r - 1;
        up *= BigInt(k + c - r);
        down *= BigInt(length - c + legs);
      }
    });
    total += up / down;
  }
  return total;
}

/** Families whose Epsil count declines past 2^53, each with a count computed another way. */
const INDEPENDENT_COUNTS: Record<string, (p: number[]) => bigint> = {
  SemistandardTableaux: semistandardByShapes,
};

for (const family of countFamilies) {
  test(`${family.head}: the fast count agrees with Epsil, past 2^53 too`, () => {
    const fast = kernelOn(ce, family);
    const epsil = epsilKernelOn(ce, family);
    const side = Array.from({ length: 6 }, (_, i) => i);
    const grid = Array.from({ length: family.paramCount }, () => side).reduce<number[][]>(
      (rest, axis) => rest.flatMap((p) => axis.map((x) => [...p, x])),
      [[]],
    );
    // The smallest box of equal sides whose fast count passes 2^53, where only the interpreter can say.
    // More points past 2^53: unequal sides, even and odd n.
    for (const p of EXTRA_PAST[family.head] ?? []) grid.push(p);
    let past = false;
    for (let s = 1; s <= 60 && !past; s++) {
      const p = Array<number>(family.paramCount).fill(s);
      const total = family.fastCount!(p);
      past = typeof total === "bigint" && total > MAX_SAFE;
      if (past) grid.push(p);
    }
    expect(past).toBe(true);
    for (const p of grid) {
      const where = labelled(family, p);
      const total = family.fastCount!(p);
      if (family.declinePastDoubles === "count" && typeof total === "bigint" && total > MAX_SAFE) {
        // Epsil's count declines there: the kernel's answer is held to a sum computed here instead.
        expect(() => epsil.count(p)).toThrow(RangeError);
        expect([where, fast.count(p)]).toEqual([where, INDEPENDENT_COUNTS[family.head]!(p)]);
      } else expect([where, fast.count(p)]).toEqual([where, epsil.count(p)]);
    }
  });
}

for (const family of fastFamilies) {
  test(`${family.head}: the fast path agrees with Epsil`, () => {
    const fast = kernelOn(ce, family);
    const epsil = epsilKernelOn(ce, family);
    let rejected = 0;
    for (const p of paramGrid(family).grid) {
      const where = labelled(family, p);
      const total = epsil.count(p);
      expect([where, fast.count(p)]).toEqual([where, total]);
      if (typeof total !== "bigint" || total > MAX_SAFE) continue;
      const members: Element[] = [];
      for (const r of ranksOf(total, interpreted(family))) {
        const element = fast.unrank(p, r);
        expect([where, r, element]).toEqual([where, r, epsil.unrank(p, r)]);
        expect([where, r, fast.rank(element, p)]).toEqual([where, r, r]);
        expect([where, r, epsil.rank(element, p)]).toEqual([where, r, r]);
        expect([where, element, fast.valid(element, p)]).toEqual([where, element, true]);
        members.push(element);
      }
      for (const member of members.filter((_, i) => i % Math.ceil(members.length / 3) === 0)) {
        for (const near of mutations(member).slice(0, DEEP ? 60 : interpreted(family) ? 2 : 14)) {
          const expected = epsil.valid(near, p);
          if (!expected) rejected++;
          expect([where, near, fast.valid(near, p)]).toEqual([where, near, expected]);
          expect([where, near, fast.rank(near, p)]).toEqual([where, near, epsil.rank(near, p)]);
        }
      }
    }
    // The near misses must include some the family rejects, or membership went unchecked.
    expect(rejected).toBeGreaterThan(0);
  });
}

test("the fast path answers up to 2^53 members, and not a member more", () => {
  expect(FAST_LIMIT).toBe(MAX_SAFE);
});

// Just past 2^53 members the fast path is asked its count and nothing else: the kernel answers
// from Epsil, as it does with the fast path turned off.
// Past 2^53 Epsil is the interpreter, seconds a call on some families: the standard run asks the
// ones where it is quick.
const QUICK_PAST_LIMIT = new Set([
  "SymmetricGroup",
  "KPermutations",
  "SignedPermutations",
  "ColoredPermutations",
  "GrayCodeSubsets",
  "Tuples",
  "Words",
  "Endofunctions",
  "BinaryStrings",
  "BinaryWords",
  "GrayCodes",
  "BinaryTreeParentArrays",
]);
// A family whose count declines past 2^53 has no answer there to compare.
for (const family of fastFamilies.filter(
  (f) => f.declinePastDoubles !== "count" && (DEEP || QUICK_PAST_LIMIT.has(f.head)),
)) {
  test(`${family.head}: a fiber past 2^53 is answered by Epsil`, () => {
    const above = paramGrid(family).above;
    // Some families (a fixed small axis) never reach 2^53 within the scan.
    if (above.length === 0) return;
    const p = above[0];
    const { family: spy, calls } = spied(family, family.fast!);
    const kernel = kernelOn(ce, spy);
    const epsil = epsilKernelOn(ce, family);
    const where = labelled(family, p);
    const total = epsil.count(p);
    expect([where, kernel.count(p)]).toEqual([where, total]);
    expect(typeof total === "bigint" && total > MAX_SAFE).toBe(true);
    const outcome = (run: () => unknown): unknown => {
      try {
        return run();
      } catch (error) {
        return String(error);
      }
    };
    for (const r of [0n, (total as bigint) - 1n]) {
      const element = outcome(() => epsil.unrank(p, r));
      expect([where, r, outcome(() => kernel.unrank(p, r))]).toEqual([where, r, element]);
      if (typeof element !== "string") expect([where, r, kernel.rank(element as Element, p)]).toEqual([where, r, r]);
    }
    // Membership never reads the count, so the fast path answers it; unrank and rank are Epsil's.
    expect(new Set(calls.filter((call) => call !== "valid"))).toEqual(new Set(["count"]));
  });
}

// A fast count may be a bigint past 2^53, trusted as exact: Epsil, a fraction of a second at the first
// params past it, must say the same.
const BIGINT_COUNTS: [string, number[]][] = [
  ["BinaryTrees", [31]],
  ["BinaryTrees", [32]],
  ["BinaryTreeParentArrays", [31]],
  ["BinaryTreeParentArrays", [33]],
  ["FullKAryTrees", [23, 3]],
  ["FullKAryTrees", [18, 5]],
  ["NonCrossingTrees", [23]],
  ["NonCrossingTrees", [25]],
  // The table families, whose Epsil count the interpreter takes seconds over just past 2^53.
  ["KCyclePermutations", [19, 5]],
  ["KCyclePermutations", [20, 5]],
  ["AlternatingPermutations", [22]],
  ["Involutions", [28]],
  ["Involutions", [29]],
  ["ConnectedPermutations", [19]],
  ["ConnectedPermutations", [20]],
  ["SeparablePermutations", [25]],
  // The recurrence families, at the first params past 2^53.
  ["MotzkinPaths", [39]],
  ["SchroederPaths", [24]],
  ["RiordanPaths", [40]],
  ["FinePaths", [32]],
  ["DyckPathsByHeight", [33, 6]],
  ["FibonacciWords", [77]],
  ["FibonacciCompositions", [78]],
  ["TriCompositions", [62]],
  ["TetraCompositions", [57]],
  ["TriStrings", [61]],
  ["OddCompositions", [79]],
  ["ProperCompositions", [80]],
  ["DyadicCompositions", [66]],
  ["SetPartitions", [23]],
  ["RestrictedGrowthStrings", [23]],
  ["SetPartitionsIntoKBlocks", [26, 5]],
  ["SetCompositions", [17]],
  ["Surjections", [23, 5]],
  // Epsil takes seconds at these.
  ...(DEEP
    ? ([
        ["TriangularCompositions", [86]],
        ["PrimeCompositions", [98]],
      ] as [string, number[]][])
    : []),
];
for (const [head, p] of BIGINT_COUNTS) {
  test(`${head}(${p.join(", ")}): the fast count past 2^53 is Epsil's`, () => {
    const family = fastFamilies.find((f) => f.head === head)!;
    // A family that declines an Epsil count past 2^53 is interpreted for the reference.
    const { declinePastDoubles: _, ...interpreted } = family;
    const total = epsilKernelOn(ce, interpreted as EpsilFamily).count(p);
    expect(typeof total === "bigint" && total > MAX_SAFE).toBe(true);
    expect(family.fast!.count(p)).toBe(total);
    expect(kernelOn(ce, family).count(p)).toBe(total);
  });
}

// Vexillary's Epsil table is 2^n states, out of reach past n = 14 or so: its exact count, past 2^53 too, is
// held to Gessel's Bessel determinant (Av(2143) is Wilf-equivalent to Av(1234)) instead.
test("VexillaryPermutations: the kernel's count past 2^53 is Gessel's", () => {
  const family = fastFamilies.find((f) => f.head === "VexillaryPermutations")!;
  const kernel = kernelOn(ce, family);
  const gessel = gesselAv1234(250);
  const first = gessel.findIndex((count) => count > MAX_SAFE);
  expect(first).toBeGreaterThan(0);
  expect(first).toBeLessThan(30);
  for (const n of [0, 1, 8, first - 1, first, first + 1, 30, 100, 250])
    expect([n, kernel.count([n])]).toEqual([n, gessel[n]]);
});

// A family that declines past 2^53 keeps the fast path's unrank and rank for the ranks a double holds,
// also when its fast count is a bigint there and the count itself is known.
test("ShiftedStandardTableaux past 2^53: the count is exact, and unrank and rank answer small ranks", () => {
  const family = fastFamilies.find((f) => f.head === "ShiftedStandardTableaux")!;
  expect(family.declinePastDoubles).toBe("count");
  const kernel = kernelOn(ce, family);
  const p = [34];
  const total = kernel.count(p);
  expect(typeof total === "bigint" && total > MAX_SAFE).toBe(true);
  for (const r of [0n, 1n, 12345n, 2n ** 40n, 2n ** 52n]) {
    const element = kernel.unrank(p, r);
    expect([r, element]).toEqual([r, family.fast!.unrank(p, Number(r))]);
    expect(kernel.valid(element, p)).toBe(true);
    expect([r, kernel.rank(element, p)]).toEqual([r, r]);
  }
  // A rank no double holds is still declined.
  expect(() => kernel.unrank(p, MAX_SAFE + 1n)).toThrow(RangeError);
});

test("a cold count asks the fast count once, also in a family that declines past 2^53", () => {
  for (const [head, p] of [
    ["SemistandardTableaux", [10, 3]],
    ["SemistandardTableaux", [24, 12]],
  ] as const) {
    const family = countFamilies.find((f) => f.head === head)!;
    let calls = 0;
    const counted = {
      ...family,
      fastCount: (q: number[]) => {
        calls++;
        return family.fastCount!(q);
      },
    };
    kernelOn(ce, counted).count([...p]);
    expect([head, p, calls]).toEqual([head, p, 1]);
  }
});

type Reading = Pick<NumberKernel, "count" | "unrank" | "rank">;

/** TS kernels that list a family's members in another order than its Epsil definition, so they
 *  are not its fast path. */
const OTHER_ORDER: Record<string, { params: number[]; reading: Reading }> = {
  Subsets: {
    params: [4],
    reading: {
      count: ([n]) => SubsetCount(n),
      unrank: ([n], r) => SubsetUnrank(n, r),
      rank: (x) => SubsetRank(x as number[]),
    },
  },
  KSubsets: {
    params: [5, 2],
    reading: {
      count: ([n, k]) => KSubsetCount(n, k),
      unrank: ([n, k], r) => KSubsetUnrank(n, k, r),
      rank: (x) => KSubsetRank(x as number[]),
    },
  },
  IntegerCompositions: {
    params: [4],
    reading: {
      count: ([n]) => CompositionCount(n),
      unrank: ([n], r) => CompositionFromMask(n, r),
      rank: (x) => CompositionRank(x as number[]),
    },
  },
  Involutions: {
    params: [5],
    reading: {
      count: ([n]) => InvolutionCount(n),
      unrank: ([n], r) => InvolutionUnrank(n, r),
      rank: (x) => InvolutionRank(x as number[]),
    },
  },
  Derangements: {
    params: [5],
    reading: {
      count: ([n]) => DerangementCount(n),
      unrank: ([n], r) => DerangementUnrank(n, r),
      rank: (x) => DerangementRank(x as number[]),
    },
  },
  CyclicPermutations: {
    params: [5],
    reading: {
      count: ([n]) => CyclicPermutationCount(n),
      unrank: ([n], r) => CyclicPermutationUnrank(n, r),
      rank: (x) => CyclicPermutationRank(x as number[]),
    },
  },
};

for (const [head, { params, reading }] of Object.entries(OTHER_ORDER)) {
  test(`${head}: its TS kernel lists the members in another order, so it carries no fast path`, () => {
    const family = allFamilies.filter(isEpsilFamily).find((f) => f.head === head)!;
    // A count or membership kernel may stand in front of Epsil, but not an order of its own.
    expect(family.fast?.unrank(params, 0)).toBeUndefined();
    expect(family.fast?.rank([], params)).toBeUndefined();
    const epsil = epsilKernelOn(ce, family);
    expect(reading.count(params)).toBe(Number(epsil.count(params)));
    const differs = Array.from({ length: reading.count(params) }, (_, r) => r).some(
      (r) => JSON.stringify(reading.unrank(params, r)) !== JSON.stringify(epsil.unrank(params, BigInt(r))),
    );
    expect(differs).toBe(true);
  });
}

/** The family with `fast` replaced and every call to it recorded. */
function spied(family: EpsilFamily, fast: FastKernel): { family: EpsilFamily; calls: string[] } {
  const calls: string[] = [];
  const watch =
    <A extends unknown[], R>(name: string, run: (...args: A) => R) =>
    (...args: A): R => {
      calls.push(name);
      return run(...args);
    };
  return {
    calls,
    family: {
      ...family,
      fast: {
        count: watch("count", fast.count),
        unrank: watch("unrank", fast.unrank),
        rank: watch("rank", fast.rank),
        valid: watch("valid", fast.valid),
      },
    },
  };
}

test("past 2^53 the fast path is skipped and Epsil answers exactly", () => {
  const tuples = fastFamilies.find((family) => family.head === "Tuples")!;
  const { family, calls } = spied(tuples, tuples.fast!);
  const kernel = kernelOn(ce, family);
  const epsil = epsilKernelOn(ce, tuples);
  const p = [10, 20];
  expect(kernel.count(p)).toBe(10n ** 20n);
  for (const r of [0n, 12345678901234567890n, 10n ** 20n - 1n]) {
    const element = kernel.unrank(p, r);
    expect(element).toEqual(epsil.unrank(p, r));
    expect(kernel.valid(element, p)).toBe(true);
    expect(kernel.rank(element, p)).toBe(r);
  }
  // Only the count and membership are asked of the fast path: the count is not a safe integer, so
  // neither unrank nor rank is.
  expect(new Set(calls.filter((call) => call !== "valid"))).toEqual(new Set(["count"]));
});

test("a fast path that throws or declines leaves the question to Epsil", () => {
  const symmetric = fastFamilies.find((family) => family.head === "SymmetricGroup")!;
  const epsil = epsilKernelOn(ce, symmetric);
  const boom = (): never => {
    throw new RangeError("declined");
  };
  const throwing = kernelOn(ce, {
    ...symmetric,
    fast: { count: boom, unrank: boom, rank: boom, valid: boom },
  });
  const declining = kernelOn(ce, {
    ...symmetric,
    fast: {
      count: () => Number.NaN,
      unrank: () => undefined as unknown as Element,
      rank: () => Number.NaN,
      valid: () => undefined as unknown as boolean,
    },
  });
  for (const kernel of [throwing, declining]) {
    expect(kernel.count([5])).toBe(120n);
    for (const r of [0n, 7n, 119n]) {
      const element = kernel.unrank([5], r);
      expect(element).toEqual(epsil.unrank([5], r));
      expect(kernel.valid(element, [5])).toBe(true);
      expect(kernel.rank(element, [5])).toBe(r);
    }
    expect(kernel.valid([1, 1, 2, 3, 4], [5])).toBe(false);
    expect(kernel.rank([1, 1, 2, 3, 4], [5])).toBe(-1n);
  }
});

test("params the fast kernels don't read as written are left to Epsil", () => {
  const byHead = (head: string) => fastFamilies.find((family) => family.head === head)!;
  const k = byHead("KPermutations");
  const wrongArity = { fast: kernelOn(ce, k), epsil: epsilKernelOn(ce, k) };
  expect(wrongArity.fast.count([4])).toBe(wrongArity.epsil.count([4]));
  // Epsil can't read a membership with a param missing as True or False, so it declines, as does the kernel.
  const verdict = (kernel: typeof wrongArity.fast): unknown => {
    try {
      return kernel.valid([1, 2, 3, 4], [4]);
    } catch (error) {
      return (error as Error).constructor;
    }
  };
  expect(verdict(wrongArity.fast)).toBe(verdict(wrongArity.epsil));
  const s = byHead("SymmetricGroup");
  expect(kernelOn(ce, s).count([-1])).toBe(epsilKernelOn(ce, s).count([-1]));
  expect(kernelOn(ce, s).count([2.5])).toBe(epsilKernelOn(ce, s).count([2.5]));
});

test("a rank outside the fiber is left to Epsil", () => {
  const symmetric = fastFamilies.find((family) => family.head === "SymmetricGroup")!;
  const { family, calls } = spied(symmetric, symmetric.fast!);
  const kernel = kernelOn(ce, family);
  const epsil = epsilKernelOn(ce, symmetric);
  calls.length = 0;
  const outside = (): unknown => {
    try {
      return epsil.unrank([4], 24n);
    } catch (error) {
      return (error as Error).constructor;
    }
  };
  const answer = (): unknown => {
    try {
      return kernel.unrank([4], 24n);
    } catch (error) {
      return (error as Error).constructor;
    }
  };
  expect(answer()).toEqual(outside());
  expect(calls).not.toContain("unrank");
});

// ── Exactness near 2^53, against readings in BigInt ───────────────────────────────────────────
// Each case below was wrong while the fast path answered up to 2^53 on 32-bit or rounding
// arithmetic: a rank plus the count past 2^53, `Math.floor(a / b)` past 2^52, a 32-bit shift.

const byHead = (head: string): EpsilFamily => fastFamilies.find((family) => family.head === head)!;
const kernelFor = (head: string) => kernelOn(ce, byHead(head));

const bigFactorial = (n: number): bigint => (n <= 1 ? 1n : BigInt(n) * bigFactorial(n - 1));

/** The permutation of 1..n at lex rank `r`, by Lehmer decode. */
function lexPermutation(n: number, r: bigint): number[] {
  const available = Array.from({ length: n }, (_, i) => i + 1);
  const out: number[] = [];
  let rest = r;
  for (let k = n - 1; k >= 0; k--) {
    const f = bigFactorial(k);
    out.push(available.splice(Number(rest / f), 1)[0]);
    rest %= f;
  }
  return out;
}

/** The k digits of `r` in base n, the first most significant, each plus `offset`. */
function digitsOf(r: bigint, n: number, k: number, offset: number): number[] {
  const out = Array.from({ length: k }, () => 0);
  let rest = r;
  for (let i = k - 1; i >= 0; i--) {
    out[i] = Number(rest % BigInt(n)) + offset;
    rest /= BigInt(n);
  }
  return out;
}

/** The 1-based positions of the set bits of `m`, ascending. */
const bitPositions = (m: bigint, n: number): number[] =>
  Array.from({ length: n }, (_, i) => i + 1).filter((i) => ((m >> BigInt(i - 1)) & 1n) === 1n);

/** Ranks that straddle the edges of 32 bits, then run to the end of a fiber of `total`. */
const edgeRanks = (total: bigint): bigint[] =>
  [
    ...new Set([
      0n,
      1n,
      2n ** 31n - 1n,
      2n ** 31n,
      2n ** 32n + 5n,
      2n ** 40n + 12345n,
      total / 2n,
      total - 2n,
      total - 1n,
    ]),
  ]
    .filter((r) => r < total)
    .toSorted((a, b) => (a < b ? -1 : 1));

test("SymmetricGroup(18): ranks past 2^53 − 1 − n! no longer wrap", () => {
  const kernel = kernelFor("SymmetricGroup");
  const total = bigFactorial(18);
  expect(kernel.count([18])).toBe(total);
  for (const r of [
    2987774396006399n,
    total - 1n,
    total - 2n,
    total / 2n,
    2n ** 31n,
    ...Array.from({ length: 6 }, () => random(total)),
  ]) {
    const expected = lexPermutation(18, r);
    expect(PermutationUnrank(18, Number(r))).toEqual(expected);
    const element = kernel.unrank([18], r);
    expect([r, element]).toEqual([r, expected]);
    expect(kernel.rank(element, [18])).toBe(r);
    expect(PermutationRank(expected)).toBe(Number(r));
  }
});

test("Tuples(3, 33) and Words(33, 3): the last tuples are not rounded down a place", () => {
  const total = 3n ** 33n;
  for (const [head, p] of [
    ["Tuples", [3, 33]],
    ["Words", [33, 3]],
  ] as const) {
    const kernel = kernelFor(head);
    expect(kernel.count([...p])).toBe(total);
    for (const r of [...edgeRanks(total), ...Array.from({ length: 6 }, () => random(total))]) {
      const expected = digitsOf(r, 3, 33, 1);
      expect(TupleUnrank(3, 33, Number(r))).toEqual(expected);
      const element = kernel.unrank([...p], r);
      expect([head, r, element]).toEqual([head, r, expected]);
      expect(kernel.rank(element, [...p])).toBe(r);
      expect(TupleRank(expected, 3)).toBe(Number(r));
    }
  }
});

test("Tuples(39, 10): a quotient that rounds up at the last rank", () => {
  const kernel = kernelFor("Tuples");
  const total = 39n ** 10n;
  const r = total - 1n;
  expect(kernel.unrank([39, 10], r)).toEqual(Array.from({ length: 10 }, () => 39));
  expect(
    kernel.rank(
      Array.from({ length: 10 }, () => 39),
      [39, 10],
    ),
  ).toBe(r);
});

test("Surjections(53, 2): all but the two constant words, in lex order", () => {
  const kernel = kernelFor("Surjections");
  const total = 2n ** 53n - 2n;
  expect(kernel.count([53, 2])).toBe(total);
  for (const r of [...edgeRanks(total), ...Array.from({ length: 6 }, () => random(total))]) {
    // The word is r + 1 in binary (1 for a 0 bit, 2 for a 1 bit): the two constants are skipped.
    const expected = digitsOf(r + 1n, 2, 53, 1);
    const element = kernel.unrank([53, 2], r);
    expect([r, element]).toEqual([r, expected]);
    expect(kernel.rank(element, [53, 2])).toBe(r);
  }
});

test("GrayCodeSubsets(51): the Gray code of a rank past 2^31", () => {
  const kernel = kernelFor("GrayCodeSubsets");
  const total = 2n ** 51n;
  expect(kernel.count([51])).toBe(total);
  for (const r of [
    ...edgeRanks(total),
    2n ** 32n - 1n,
    2n ** 33n,
    2n ** 50n,
    ...Array.from({ length: 6 }, () => random(total)),
  ]) {
    const expected = bitPositions(r ^ (r >> 1n), 51);
    expect(GrayCodeSubsetUnrank(51, Number(r))).toEqual(expected);
    const element = kernel.unrank([51], r);
    expect([r, element]).toEqual([r, expected]);
    expect(kernel.rank(element, [51])).toBe(r);
    expect(GrayCodeSubsetRank(expected)).toBe(Number(r));
  }
});

test("GrayCodes(40), BinaryStrings(52), BinaryPalindromes(70), BinaryWords(45): bits past the 32nd", () => {
  const cases: [string, number[], bigint, (r: bigint) => number[]][] = [
    ["GrayCodes", [40], 2n ** 40n, (r) => digitsOf(r ^ (r >> 1n), 2, 40, 0)],
    ["BinaryStrings", [52], 2n ** 52n, (r) => digitsOf(r, 2, 52, 0)],
    ["BinaryWords", [45], 2n ** 45n, (r) => digitsOf(r, 2, 45, 0)],
    ["BinaryPalindromes", [70], 2n ** 35n, (r) => [...digitsOf(r, 2, 35, 0), ...digitsOf(r, 2, 35, 0).toReversed()]],
  ];
  for (const [head, p, total, reading] of cases) {
    const kernel = kernelFor(head);
    expect(kernel.count(p)).toBe(total);
    for (const r of [...edgeRanks(total), 2n ** 32n - 1n, ...Array.from({ length: 4 }, () => random(total))].filter(
      (r) => r < total,
    )) {
      const element = kernel.unrank(p, r);
      expect([head, r, element]).toEqual([head, r, reading(r)]);
      expect([head, r, kernel.rank(element, p)]).toEqual([head, r, r]);
    }
  }
});

test("Subsets and LabeledGraphs: a mask past 2^31 is not truncated to 32 bits", () => {
  const total = 2n ** 52n;
  for (const r of [...edgeRanks(total), 2n ** 32n - 1n, 2n ** 51n, ...Array.from({ length: 6 }, () => random(total))]) {
    const expected = bitPositions(r, 52);
    expect(SubsetUnrank(52, Number(r))).toEqual(expected);
    expect(SubsetRank(expected)).toBe(Number(r));
  }
  // LabeledGraphs(9): edge k of K_9 (pairs in lex order) is present when bit k of the rank is set.
  const pairs: number[][] = [];
  for (let u = 1; u < 9; u++) for (let v = u + 1; v <= 9; v++) pairs.push([u, v]);
  const kernel = kernelFor("LabeledGraphs");
  expect(kernel.count([9])).toBe(2n ** 36n);
  for (const r of [...edgeRanks(2n ** 36n), ...Array.from({ length: 6 }, () => random(2n ** 36n))]) {
    const expected = bitPositions(r, 36).map((i) => pairs[i - 1]);
    const element = kernel.unrank([9], r);
    expect([r, element]).toEqual([r, expected]);
    expect(kernel.rank(element, [9])).toBe(r);
  }
});

test("PhylogeneticTreeUnrank(16, 2819674067578180): a digit quotient that rounds up near 2^52", () => {
  // Digits d_3..d_n of radix 2k − 3, k = n least significant.
  const digits = (n: number, r: bigint): number[] => {
    const out = Array.from({ length: n - 2 }, () => 0);
    let rest = r;
    for (let k = n; k >= 3; k--) {
      out[k - 3] = Number(rest % BigInt(2 * k - 3));
      rest /= BigInt(2 * k - 3);
    }
    return out;
  };
  const family = allFamilies.filter(isEpsilFamily).find((f) => f.head === "PhylogeneticTrees")!;
  const epsil = epsilKernelOn(ce, family);
  const total = epsil.count([16]) as bigint;
  let product = 1n;
  for (let k = 3; k <= 16; k++) product *= BigInt(2 * k - 3);
  expect(total).toBe(product);
  for (const r of [2819674067578180n, total - 1n, total / 2n, ...Array.from({ length: 6 }, () => random(total))]) {
    const expected = digits(16, r);
    expect([r, PhylogeneticTreeUnrank(16, Number(r))]).toEqual([r, expected]);
    expect([r, epsil.unrank([16], r)]).toEqual([r, expected]);
  }
});

test("Binomial and CatalanNumber are exact up to 2^53", () => {
  const exact = (n: number, k: number): bigint => {
    let c = 1n;
    for (let i = 0; i < k; i++) c = (c * BigInt(n - i)) / BigInt(i + 1);
    return c;
  };
  const check = (n: number, k: number): void => {
    const want = exact(n, k);
    const got = Binomial(n, k);
    if (want <= MAX_SAFE) expect([n, k, got]).toEqual([n, k, Number(want)]);
    else expect([n, k, got > Number(MAX_SAFE)]).toEqual([n, k, true]);
  };
  for (let n = 0; n <= 100; n++) for (let k = 0; k <= n; k++) check(n, k);
  // Wide rows with a small k: the partial products pass 2^53 before the answer does.
  for (const [n, k] of [
    [1275, 6],
    [3000, 5],
    [100000, 3],
    [50, 25],
    [56, 28],
    [60, 30],
  ])
    check(n, k);
  expect(Binomial(1275, 6)).toBe(Number(exact(1275, 6)));
  for (let n = 0; n <= 40; n++) {
    const want = exact(2 * n, n) / BigInt(n + 1);
    if (want <= MAX_SAFE) expect([n, CatalanNumber(n)]).toEqual([n, Number(want)]);
    else expect([n, CatalanNumber(n) > Number(MAX_SAFE)]).toEqual([n, true]);
  }
});

test("floorDiv, modRank and ipow are exact on safe integers", () => {
  for (let i = 0; i < 400; i++) {
    const a = random(MAX_SAFE + 1n);
    const b = 1n + random(i % 2 === 0 ? 100n : 2n ** 40n);
    expect([a, b, floorDiv(Number(a), Number(b))]).toEqual([a, b, Number(a / b)]);
    expect([a, b, modRank(Number(a), Number(b))]).toEqual([a, b, Number(a % b)]);
    if (a % b !== 0n) expect([a, b, modRank(-Number(a), Number(b))]).toEqual([a, b, Number(b - (a % b))]);
  }
  for (const [base, exp] of [
    [3, 33],
    [5, 22],
    [7, 18],
    [10, 15],
    [39, 10],
    [2, 52],
    [6, 20],
  ])
    expect([base, exp, ipow(base, exp)]).toEqual([base, exp, Number(BigInt(base) ** BigInt(exp))]);
  expect(ipow(2, 1e9)).toBeGreaterThan(Number(MAX_SAFE));
  expect(ipow(1, 1e9)).toBe(1);
});
