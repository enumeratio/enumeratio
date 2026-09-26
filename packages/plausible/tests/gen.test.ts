import { expect, test } from "vite-plus/test";
import { between, hash, random, randomBelow, sizeAt, streamFor } from "../src/index.ts";

test("mulberry32 is the same stream the samplers have always drawn", () => {
  const next = random(1);
  // The first draws for seed 1 — pinned so a change to the generator is a visible decision.
  expect([next(), next(), next()].map((x) => Math.round(x * 1e9))).toEqual([627073941, 2735721, 527447040]);
});

test("a key's stream doesn't depend on other keys", () => {
  const a = streamFor(42, "Partitions");
  const b = streamFor(42, "Partitions");
  streamFor(42, "Permutations")();
  expect(a()).toBe(b());
  expect(streamFor(42, "Partitions")()).not.toBe(streamFor(42, "Permutations")());
  expect(hash("a")).toBe(0xe40c292c);
});

test("randomBelow stays in range, past 2^53 too", () => {
  const rng = random(7);
  for (const n of [1n, 2n, 10n, 2n ** 60n, 10n ** 30n]) {
    for (let i = 0; i < 50; i++) {
      const r = randomBelow(rng, n);
      expect(r >= 0n && r < n).toBe(true);
    }
  }
});

test("between hits both ends and stays inside", () => {
  const rng = random(3);
  const seen = new Set<number>();
  for (let i = 0; i < 400; i++) seen.add(between(rng, 2, 9));
  expect(Math.min(...seen)).toBe(2);
  expect(Math.max(...seen)).toBe(9);
  expect(between(rng, 5, 5)).toBe(5);
});

test("the size ramp runs from 0 to maxSize", () => {
  expect([0, 1, 2, 3, 4].map((i) => sizeAt(i, 5, 8))).toEqual([0, 2, 4, 6, 8]);
  expect(sizeAt(0, 1, 8)).toBe(8);
});
