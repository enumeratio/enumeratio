// A family's `fast` path is a hand-written reading that answers ahead of its Epsil definitions
// while the fiber's count is a safe integer. The definitions are the meaning, so every fast
// family is held to them here: over a sampled grid of params, the fast kernel and the kernel
// built from Epsil alone agree on count, unrank, rank and valid (members and near misses).

import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
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
  CompositionCount,
  CompositionFromMask,
  CompositionRank,
} from "../collections/src/families/kernels-combinatorics.ts";
import {
  CyclicPermutationCount,
  CyclicPermutationRank,
  CyclicPermutationUnrank,
  DerangementCount,
  DerangementRank,
  DerangementUnrank,
  InvolutionCount,
  InvolutionRank,
  InvolutionUnrank,
  KSubsetCount,
  KSubsetRank,
  KSubsetUnrank,
  SubsetCount,
  SubsetRank,
  SubsetUnrank,
} from "../collections/src/families/kernels-extra.ts";
import type { Element } from "../collections/src/families/types.ts";

const DEEP = process.env.DEEP_TESTS === "1";
const ce = new ComputeEngine();
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
// How far params are scanned for the edge of the fast path; Epsil is slow on long elements.
const SCAN = DEEP ? 44 : 32;

const fastFamilies = allFamilies.filter(isEpsilFamily).filter((family) => family.fast !== undefined);

/** The params to try: small ones, and the edge where the fast path stops answering. */
function paramGrid(family: EpsilFamily): number[][] {
  const fast = family.fast!;
  const safe = (p: number[]): boolean => {
    try {
      return fast.count(p) <= Number(FAST_LIMIT);
    } catch {
      return false;
    }
  };
  const small = DEEP ? [0, 1, 2, 3, 4, 5, 6, 8, 10, 13] : [0, 1, 2, 3, 5, 8];
  if (family.paramCount === 1) {
    // The largest n the fast path answers, found by scanning up.
    let edge = 0;
    for (let n = 0; n <= SCAN; n++) if (safe([n])) edge = n;
    return [...new Set([...small, edge - 1, edge])].filter((n) => n >= 0 && safe([n])).map((n) => [n]);
  }
  const grid = small.flatMap((a) => small.map((b) => [a, b])).filter(safe);
  // The edge along each axis, from a few fixed values on the other.
  for (const fixed of [1, 2, 3, 5]) {
    let a = 0;
    let b = 0;
    for (let n = 0; n <= SCAN; n++) {
      if (safe([fixed, n])) b = n;
      if (safe([n, fixed])) a = n;
    }
    if (safe([fixed, b])) grid.push([fixed, b]);
    if (safe([a, fixed])) grid.push([a, fixed]);
  }
  return grid;
}

/** Ranks of a fiber of `total`: all when small, else spread evenly with both ends. */
function ranksOf(total: bigint): bigint[] {
  const all = DEEP ? 120n : 24n;
  if (total <= all) return Array.from({ length: Number(total) }, (_, i) => BigInt(i));
  const spread = DEEP ? 120n : 16n;
  return Array.from({ length: Number(spread) }, (_, i) => (BigInt(i) * (total - 1n)) / (spread - 1n));
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

for (const family of fastFamilies) {
  test(`${family.head}: the fast path agrees with Epsil`, () => {
    const fast = kernelOn(ce, family);
    const epsil = epsilKernelOn(ce, family);
    let rejected = 0;
    for (const p of paramGrid(family)) {
      const where = labelled(family, p);
      const total = epsil.count(p);
      expect([where, fast.count(p)]).toEqual([where, total]);
      if (typeof total !== "bigint" || total > MAX_SAFE) continue;
      const members: Element[] = [];
      for (const r of ranksOf(total)) {
        const element = fast.unrank(p, r);
        expect([where, r, element]).toEqual([where, r, epsil.unrank(p, r)]);
        expect([where, r, fast.rank(element, p)]).toEqual([where, r, r]);
        expect([where, r, epsil.rank(element, p)]).toEqual([where, r, r]);
        expect([where, element, fast.valid(element, p)]).toEqual([where, element, true]);
        members.push(element);
      }
      for (const member of members.filter((_, i) => i % Math.ceil(members.length / 3) === 0)) {
        for (const near of mutations(member).slice(0, DEEP ? 60 : 14)) {
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

type Reading = Pick<FastKernel, "count" | "unrank" | "rank">;

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
    expect(family.fast).toBeUndefined();
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
  // Only the count is asked of the fast path: it is not a safe integer, so nothing more is.
  expect(new Set(calls)).toEqual(new Set(["count"]));
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
  expect(wrongArity.fast.valid([1, 2, 3, 4], [4])).toBe(wrongArity.epsil.valid([1, 2, 3, 4], [4]));
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
