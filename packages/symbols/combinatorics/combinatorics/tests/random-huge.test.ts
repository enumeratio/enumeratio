// `Random` over collections past 2^53: a uniform bigint rank, unranked by the family. A collection
// that is infinite or can't be addressed stays unevaluated and says why.

import { collectMessages, ensureRandom, randomBelow } from "@enumeratio/engine";
import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { declareCombinatorics } from "../src/index.ts";

const ce = bareEngine();
declareCombinatorics(ce);
ensureRandom(ce);

const run = (expr: unknown) => ce.box(expr as never).evaluate();
const draw = (seed: number, n: number) => {
  run(["SeedRandom", seed]);
  return run(["Random", ["SymmetricGroup", n]]);
};

/** The one-line images of a drawn permutation, however the engine boxes it. */
const imagesOf = (drawn: ReturnType<typeof run>): number[] => {
  const found: number[] = [];
  const walk = (x: unknown): void => {
    if (Array.isArray(x)) x.forEach(walk);
    else if (typeof x === "number") found.push(x);
  };
  walk(drawn.json);
  return found;
};
const isPermutation = (xs: number[], n: number) =>
  xs.length === n && xs.toSorted((a, b) => a - b).every((x, i) => x === i + 1);

test("randomBelow is uniform past 32 bits (chi-square over small residues of a huge range)", () => {
  // A modulus that doesn't divide 2^32 would show modulo bias at this size if rejection were skipped.
  const n = 3n * 2n ** 40n;
  const buckets = new Array<number>(6).fill(0);
  const draws = 6000;
  for (let i = 0; i < draws; i++) buckets[Number((randomBelow(ce, n) * 6n) / n)]++;
  const expected = draws / buckets.length;
  const chi = buckets.reduce((sum, seen) => sum + (seen - expected) ** 2 / expected, 0);
  expect(chi).toBeLessThan(20.5); // 5 degrees of freedom, p = 0.001
});

test("randomBelow covers a small range exactly", () => {
  const seen = new Set<bigint>();
  for (let i = 0; i < 200; i++) seen.add(randomBelow(ce, 7n));
  expect([...seen].toSorted((a, b) => Number(a - b))).toEqual([0n, 1n, 2n, 3n, 4n, 5n, 6n]);
});

test("Random(SymmetricGroup(19)) draws a permutation of 19 and reproduces under SeedRandom", () => {
  const a = draw(3, 19);
  expect(a.operator).not.toBe("Random");
  expect(isPermutation(imagesOf(a), 19)).toBe(true);
  expect(draw(3, 19).json).toEqual(a.json);
  expect(draw(4, 19).json).not.toEqual(a.json);
});

test("Random(Permutations(25)) draws a permutation of 25", () => {
  run(["SeedRandom", 5]);
  const drawn = run(["Random", ["Permutations", 25]]);
  expect(drawn.operator).not.toBe("Random");
  expect(isPermutation(imagesOf(drawn), 25)).toBe(true);
});

test("Random over an infinite collection stays unevaluated and says why", () => {
  const { value, messages } = collectMessages(ce, () => run(["Random", "PrimeNumbers"]));
  expect(value.operator).toBe("Random");
  expect(messages.map((m) => `${m.head}::${m.code}`)).toEqual(["Random::infinite"]);
});
