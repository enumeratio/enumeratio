// A permutation restriction's compiled table runs past the largest double where its entries grow
// like n! (from n = 171) or faster, and the interpreter, which takes minutes over its exact twin,
// used to be the fallback. Now a call answers or declines at once (a RangeError: unknown through
// the engine), never hangs.

import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { kernelOn } from "../collections/src/families/epsil.ts";
import { allFamilies } from "../collections/src/families/index.ts";
import { declareCombinatorics } from "../src/index.ts";

const ce = bareEngine();
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const iota = (n: number): number[] => Array.from({ length: n }, (_, i) => i + 1);
// Far past what the interpreter answers, so a hang cannot pass, yet clear of CI load.
const BUDGET_MS = 3000;

/** The answer, or "declined" for a RangeError, and how long it took. */
function timed(f: () => unknown): { answer: unknown; ms: number } {
  const start = performance.now();
  let answer: unknown;
  try {
    answer = f();
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    answer = "declined";
  }
  return { answer, ms: performance.now() - start };
}

const kernelFor = (head: string) =>
  kernelOn(
    ce,
    allFamilies.find((f) => f.head === head)!,
  );

/** The kernel with each operation compiled already, so what is timed is the call alone. */
function warmKernel(head: string, small: number[]) {
  const kernel = kernelFor(head);
  const member = kernel.unrank(small, 0n);
  kernel.count(small);
  kernel.rank(member, small);
  kernel.valid(member, small);
  return kernel;
}

test("a fiber of one member, at any size, is unranked and ranked at once", () => {
  for (const [head, small, p, member] of [
    ["KCyclePermutations", [6, 6], [200, 200], iota(200)],
    ["KDescentPermutations", [6, 0], [200, 0], iota(200)],
    ["KDescentPermutations", [6, 5], [200, 199], iota(200).toReversed()],
    ["KCyclePermutations", [6, 6], [500, 500], iota(500)],
  ] as [string, number[], number[], number[]][]) {
    const kernel = warmKernel(head, small);
    const where = `${head}(${p.join(", ")})`;
    const results = {
      count: timed(() => kernel.count(p)),
      unrank: timed(() => kernel.unrank(p, 0n)),
      rank: timed(() => kernel.rank(member, p)),
    };
    expect([where, results.count.answer, results.unrank.answer, results.rank.answer]).toEqual([where, 1n, member, 0n]);
    expect([where, Math.max(...Object.values(results).map((r) => r.ms)) < BUDGET_MS]).toEqual([where, true]);
    // The fiber has one member: a second rank is outside it, and a non-member is nowhere.
    expect(() => kernel.unrank(p, 1n)).toThrow(RangeError);
    expect(kernel.rank([...member, 0], p)).toBe(-1n);
  }
  const engine = bareEngine();
  declareCombinatorics(engine);
  const at = engine.box(["At", ["KCyclePermutations", 200, 200], 1] as never).evaluate().json;
  expect(at).toEqual(["Permutation", ["List", ...iota(200)]]);
});

test("a fiber of n − 1 cycles is C(n, 2) transpositions: unranked and ranked at once, at any size", () => {
  for (const n of [200, 500, 2000]) {
    const kernel = warmKernel("KCyclePermutations", [6, 5]);
    const p = [n, n - 1];
    const total = (BigInt(n) * BigInt(n - 1)) / 2n;
    const first = timed(() => kernel.unrank(p, 0n));
    const last = timed(() => kernel.unrank(p, total - 1n));
    // The first in lex order swaps the last two, the last swaps the first two and moves 1 to the back.
    expect([n, first.answer, last.answer]).toEqual([n, [...iota(n - 2), n, n - 1], [n, ...iota(n).slice(1, -1), 1]]);
    const ranks = [first, last].map((r) => timed(() => kernel.rank(r.answer as number[], p)));
    expect([n, ranks.map((r) => r.answer)]).toEqual([n, [0n, total - 1n]]);
    expect(Math.max(first.ms, last.ms, ...ranks.map((r) => r.ms))).toBeLessThan(BUDGET_MS);
    expect(() => kernel.unrank(p, total)).toThrow(RangeError);
  }
  const engine = bareEngine();
  declareCombinatorics(engine);
  expect(engine.box(["Count", ["KCyclePermutations", 200, 199]] as never).evaluate().json).toBe(19900);
  const at = engine.box(["At", ["KCyclePermutations", 200, 199], 1] as never).evaluate().json;
  expect(at).toEqual(["Permutation", ["List", ...iota(198), 200, 199]]);
});

test("an empty fiber at any size has no member to unrank", () => {
  const kernel = warmKernel("KCyclePermutations", [6, 6]);
  expect(kernel.count([200, 201])).toBe(0n);
  expect(() => kernel.unrank([200, 201], 0n)).toThrow(RangeError);
  expect(kernel.rank(iota(200), [200, 201])).toBe(-1n);
});

// Where the sizes overflow doubles, each call answers or declines at once. `member` is a real member
// of the fiber, so rank and membership are asked of one (not a quick -1).
const cycle = (n: number, length: number): number[] => iota(n).map((v) => (v === length ? 1 : v <= length ? v + 1 : v));
const alternating = (n: number): number[] => {
  const x = [1];
  for (let j = 2; j < n; j += 2) x.push(j + 1, j);
  if (n % 2 === 0) x.push(n);
  return x;
};
for (const [head, small, p, member] of [
  // k = 10 cycles: one of 191 elements, and nine fixed points.
  ["KCyclePermutations", [6, 3], [200, 10], cycle(200, 191)],
  // 100 descents: (2 1)(4 3)…
  ["KDescentPermutations", [6, 2], [200, 100], iota(200).map((v) => (v % 2 === 0 ? v - 1 : Math.min(v + 1, 200)))],
  ["AlternatingPermutations", [6], [200], alternating(200)],
  ["NonCrossingCycleSupportPermutations", [6], [200], iota(200)],
  ["AdjacentTranspositionInvolutions", [6], [200], iota(200)],
  ["Involutions", [6], [500], iota(500)],
  ["SeparablePermutations", [6], [500], iota(500)],
  ["VexillaryPermutations", [6], [500], iota(500)],
  ["ConnectedPermutations", [6], [500], iota(500).toReversed()],
] as [string, number[], number[], number[]][]) {
  test(`${head}(${p.join(", ")}): count, unrank, rank and membership answer or decline at once`, () => {
    const kernel = warmKernel(head, small);
    const where = `${head}(${p.join(", ")})`;
    const count = timed(() => kernel.count(p));
    const unrank = timed(() => kernel.unrank(p, 0n));
    const valid = timed(() => kernel.valid(member, p));
    const rank = timed(() => kernel.rank(member, p));
    expect([where, Math.max(count.ms, unrank.ms, valid.ms, rank.ms) < BUDGET_MS]).toEqual([where, true]);
    // The member is one: membership is True or unknown, and a rank is a place or unknown, never "not a member".
    expect([where, valid.answer === true || valid.answer === "declined"]).toEqual([where, true]);
    expect([where, rank.answer !== -1n]).toEqual([where, true]);
    // Each fiber is past 2^53, where the first member and the place of a member are unknown.
    expect([where, unrank.answer, rank.answer]).toEqual([where, "declined", "declined"]);
  });
}

test("Connected, Separable and Vexillary counts past doubles: exact where cheap, unknown at once past it", () => {
  const engine = bareEngine();
  declareCombinatorics(engine);
  const count = (head: string, n: number): unknown => engine.box(["Count", [head, n]] as never).evaluate().json;
  for (const [head, n] of [
    ["ConnectedPermutations", 500],
    ["SeparablePermutations", 500],
    ["VexillaryPermutations", 500],
  ] as [string, number][]) {
    const { answer, ms } = timed(() => count(head, n));
    expect([head, typeof (answer as { num?: unknown }).num, ms < BUDGET_MS]).toEqual([head, "string", true]);
  }
  // Past Connected's bound its table is out of reach, and the answer is unknown, not a hang.
  const past = timed(() => count("ConnectedPermutations", 5000));
  expect([past.answer, past.ms < BUDGET_MS]).toEqual([["Count", ["ConnectedPermutations", 5000]], true]);
});

test("SeparablePermutations(23), (24): a count a double holds, but a table it doesn't, declines at once and says so", () => {
  const kernel = warmKernel("SeparablePermutations", [6]);
  // n = 22 still unranks and ranks; from 23 the compiled table leaves the safe integers a size before the count does.
  const small = kernel.unrank([22], 7n);
  expect(kernel.rank(small, [22])).toBe(7n);
  for (const n of [23, 24]) {
    const p = [n];
    const total = kernel.count(p) as bigint;
    expect(total > 0n && total <= MAX_SAFE).toBe(true);
    const x = iota(n);
    expect(kernel.valid(x, p)).toBe(true);
    for (const call of [() => kernel.unrank(p, 0n), () => kernel.rank(x, p)]) {
      const start = performance.now();
      expect(call).toThrow(/table doesn't fit in doubles, not bigint yet/);
      expect(performance.now() - start).toBeLessThan(BUDGET_MS);
    }
  }
});

test("Involutions(500): the exact count, from the telephone recurrence", () => {
  const kernel = warmKernel("Involutions", [6]);
  const { answer, ms } = timed(() => kernel.count([500]));
  expect(typeof answer === "bigint" && answer > MAX_SAFE).toBe(true);
  expect(ms).toBeLessThan(BUDGET_MS);
});

test("KInversionPermutations(200, 0): a fiber of one, from the interpreter, answers at once", () => {
  const kernel = warmKernel("KInversionPermutations", [6, 0]);
  const p = [200, 0];
  const unrank = timed(() => kernel.unrank(p, 0n));
  expect(unrank.answer).toEqual(iota(200));
  expect(unrank.ms).toBeLessThan(BUDGET_MS);
  expect(timed(() => kernel.rank(iota(200), p)).answer).toBe(0n);
});
