// A family that opts in with `bigSamples` answers past 2^53 from BigInt-compiled code. The
// interpreter is the oracle: the same family without the opt-in. The wide sweep is in
// compiled-families.test.ts (DEEP_TESTS).

import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { COMPILED_FAMILIES } from "../collections/src/families/compiled-families.generated.js";
import { allFamilies } from "../collections/src/families/index.ts";
import { familyHash, isEpsilFamily, kernelOn, type EpsilFamily } from "../collections/src/families/epsil.ts";
import { definitions } from "../collections/src/families/sequence-definitions.ts";
import { dyckPaths, motzkinPaths, schroederPaths } from "../lattice-paths/src/families/core.ts";

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

const catalan = (n: bigint): bigint => {
  let c = 1n;
  for (let k = 0n; k < n; k++) c = (c * 2n * (2n * k + 1n)) / (k + 2n);
  return c;
};

const ce = bareEngine();
const big = kernelOn(ce, dyckPaths);
const interpreted = kernelOn(ce, { ...dyckPaths, bigSamples: undefined } as EpsilFamily, {});

test("DyckPaths opts in", () => {
  expect(dyckPaths.bigSamples).toBeDefined();
});

test("the count is exact past 2^53", () => {
  for (const n of [31, 35, 40, 60]) {
    expect(big.count([n])).toBe(catalan(BigInt(n)));
    expect(catalan(BigInt(n)) > MAX_SAFE).toBe(true);
  }
});

test("unrank and rank agree with the interpreter past 2^53, and rank undoes unrank", () => {
  for (const n of [31, 33, 36]) {
    const total = big.count([n]) as bigint;
    for (const r of [0n, 1n, total / 3n, total / 2n, total - 1n]) {
      const path = big.unrank([n], r);
      expect(path).toEqual(interpreted.unrank([n], r));
      expect(big.rank(path, [n])).toBe(r);
    }
  }
});

test("a rank outside the fiber still throws a RangeError", () => {
  const total = big.count([32]) as bigint;
  expect(() => big.unrank([32], total)).toThrow(RangeError);
});

test("BigInt code is used where generated, and the kernel answers the same without it", () => {
  const generated = COMPILED_FAMILIES as unknown as Record<string, { big?: object }>;
  // A build that stubbed the generated module has no code to check; the kernel compiles on first use then.
  if (Object.keys(generated).length > 0) expect(Object.keys(generated.DyckPaths?.big ?? {})).toContain("unrank");
  const marked = kernelOn(ce, dyckPaths, {
    DyckPaths: { hash: familyHash(dyckPaths), big: {}, bigInterpreted: ["count", "unrank", "rank"] },
  });
  expect(marked.count([32])).toBe(big.count([32]));
});

test("a fiber a double holds stays on the double path", () => {
  expect(big.count([20])).toBe(catalan(20n));
  expect(big.rank(big.unrank([20], 123456n), [20])).toBe(123456n);
});

// A sequence: the terms are past 2^53 from rank 31, where the double path and its fold bound can't follow.
const catalanFamily = definitions.get("CatalanNumbers")!;
const catalanTerms = kernelOn(ce, catalanFamily, COMPILED_FAMILIES, { fast: false });
const catalanInterpreted = kernelOn(
  ce,
  { ...catalanFamily, bigSamples: undefined } as EpsilFamily,
  {},
  { fast: false },
);

test("CatalanNumbers opts in, and its terms past 2^53 are exact", () => {
  expect(catalanFamily.bigSamples).toBeDefined();
  for (const r of [31n, 40n, 120n]) {
    const term = catalanTerms.unrank([], r);
    expect(BigInt(term as unknown as bigint)).toBe(catalan(r));
    expect(catalanTerms.rank(term, [])).toBe(r);
    expect(catalanTerms.valid(term, [])).toBe(true);
    expect(catalanTerms.valid(BigInt(term as unknown as bigint) + 1n, [])).toBe(false);
  }
});

test("CatalanNumbers agrees with the interpreter past 2^53", () => {
  for (const r of [31n, 45n]) {
    const term = catalanInterpreted.unrank([], r);
    expect(catalanTerms.unrank([], r)).toEqual(term);
    expect(catalanTerms.rank(term, [])).toBe(catalanInterpreted.rank(term, []));
    expect(catalanTerms.valid(term, [])).toBe(catalanInterpreted.valid(term, []));
  }
});

test("the loop bound that was a Log reads the same on doubles", () => {
  for (const x of [0, 1, 2, 3, 13, 14, 42, 43, 2 ** 40, 2 ** 53 - 1]) {
    expect(catalanTerms.rank(x as never, [])).toBe(catalanInterpreted.rank(x as never, []));
    expect(catalanTerms.valid(x as never, [])).toBe(catalanInterpreted.valid(x as never, []));
  }
});

// Table-based walks: the table is built once over BigInts, and unrank and rank read it.
test.each([
  ["MotzkinPaths", motzkinPaths, [39]],
  ["SchroederPaths", schroederPaths, [24]],
])("%s answers past 2^53 from a BigInt table", (_head, family, p) => {
  expect(family.bigSamples).toBeDefined();
  const tables: string[] = [];
  const kernel = kernelOn(ce, family, COMPILED_FAMILIES, { onTables: (_p, precision) => tables.push(precision) });
  const oracle = kernelOn(ce, { ...family, bigSamples: undefined } as EpsilFamily, {});
  const total = kernel.count(p) as bigint;
  expect(total > MAX_SAFE).toBe(true);
  for (const r of [0n, 1n, total / 2n, total - 1n]) {
    const path = kernel.unrank(p, r);
    expect(path).toEqual(oracle.unrank(p, r));
    expect(kernel.rank(path, p)).toBe(r);
  }
  expect(tables).toEqual(["big"]);
});

// The families that declined past 2^53 and now answer from BigInt code: an independent count, rank undoing
// unrank, and (where the interpreter takes seconds, not minutes, a call) unrank as the interpreter has it.
const choose = (n: bigint, k: bigint): bigint => {
  let c = 1n;
  for (let i = 1n; i <= k; i++) c = (c * (n - k + i)) / i;
  return c;
};
const optedIn: readonly (readonly [head: string, p: number[], count: (() => bigint) | undefined, oracle: boolean])[] = [
  ["NonCrossingTrees", [23], () => choose(69n, 23n) / 47n, true],
  ["BinaryTreeParentArrays", [31], () => catalan(31n), true],
  ["NonCrossingPartitions", [31], () => catalan(31n), true],
  ["NonNestingPartitions", [31], () => catalan(31n), true],
  ["PartCountBoundedCompositions", [55, 55], () => 2n ** 54n, true],
  // Counted by their TS kernels' exact classes.
  ["CarlitzCompositions", [68], undefined, true],
  ["ZigzagCompositions", [82], undefined, false],
  ["ParkingFunctions", [15], () => 16n ** 14n, false],
];
const byHead = new Map(allFamilies.filter(isEpsilFamily).map((family) => [family.head, family]));

test.each(optedIn)(
  "%s answers past 2^53 from BigInt code",
  (head, p, count, oracle) => {
    const family = byHead.get(head)!;
    expect(family.bigSamples).toBeDefined();
    expect(family.declinePastDoubles).toBeUndefined();
    const kernel = kernelOn(ce, { ...family, fast: undefined, fastCount: undefined } as EpsilFamily, COMPILED_FAMILIES);
    const exact = family.fast?.count ?? family.fastCount;
    const total = kernel.count(p) as bigint;
    expect(total).toBe(count?.() ?? BigInt(exact!(p) as bigint));
    expect(total > MAX_SAFE).toBe(true);
    const interpreted = oracle
      ? kernelOn(ce, { ...family, bigSamples: undefined, fast: undefined } as EpsilFamily, {})
      : undefined;
    for (const r of [0n, total / 3n, total - 1n]) {
      const element = kernel.unrank(p, r);
      expect(kernel.rank(element, p)).toBe(r);
      expect(kernel.valid(element, p)).toBe(true);
      if (interpreted !== undefined && r !== 0n) expect(element).toEqual(interpreted.unrank(p, r));
    }
  },
  120_000,
);
