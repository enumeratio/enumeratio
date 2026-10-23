// A map's hand-written kernel is a fast path for its Epsil, which stays the meaning: each kernel gives the
// Epsil's answer, over every small element of its carrier (the standard run) and larger ones (the deep run).

import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { evaluateDefinition, MAPS } from "../src/maps.ts";
import { permutations } from "./maps-helpers.ts";

const ce = bareEngine();
const list = (value: readonly unknown[]): unknown => ["List", ...value.map((x) => (Array.isArray(x) ? list(x) : x))];

// Epsil at size 6 takes a good fraction of a second: a few spread elements there, everything below.
const SPREAD_6 = [
  [1, 2, 3, 4, 5, 6],
  [6, 5, 4, 3, 2, 1],
  [3, 1, 6, 2, 5, 4],
  [2, 4, 6, 1, 3, 5],
];

const SPREAD_7 = [
  [1, 2, 3, 4, 5, 6, 7],
  [7, 6, 5, 4, 3, 2, 1],
  [4, 1, 6, 3, 7, 2, 5],
  [2, 7, 1, 5, 3, 6, 4],
];

// The standard run covers sizes 1-4; `DEEP_TESTS=1` (the nightly sweep) takes sizes 5-7.
const deep = process.env.DEEP_TESTS === "1";

for (const map of MAPS.filter((m) => m.kernel !== undefined)) {
  // CactusEvacuation's Epsil is three RSK passes: sparser samples.
  const cactus = map.name === "CactusEvacuation";
  const subjects = deep
    ? [...permutations(5).filter((_, i) => !cactus || i % 7 === 0), ...SPREAD_6, ...(cactus ? [] : SPREAD_7)]
    : [1, 2, 3, 4].flatMap((n) => permutations(n));
  test(`${map.name}'s kernel gives the Epsil's answers`, { timeout: 300_000 }, () => {
    for (const subject of subjects) {
      const kernel = map.kernel!(subject as never);
      expect(list(kernel as unknown[]), JSON.stringify(subject)).toEqual(evaluateDefinition(ce, map, list(subject)));
    }
  });
}

test("every kernel declines what is not a permutation", () => {
  for (const map of MAPS.filter((m) => m.kernel !== undefined)) {
    expect(map.kernel!([1, 1, 2] as never), map.name).toBeUndefined();
    expect(map.kernel!([2, 3, 4] as never), map.name).toBeUndefined();
  }
});

test("CactusEvacuation's kernel declines what is not a permutation", async () => {
  const { cactusEvacuationKernel } = await import("../tableaux/src/promotion.ts");
  expect(cactusEvacuationKernel([1, 1, 2])).toBeUndefined();
  expect(cactusEvacuationKernel([2, 3, 4])).toBeUndefined();
  expect(cactusEvacuationKernel([])).toEqual([]);
});

test("CactusEvacuation is an involution, at sizes the Epsil can't afford to check exhaustively", () => {
  const kernel = MAPS.find((m) => m.name === "CactusEvacuation")!.kernel!;
  for (const word of permutations(7)) expect(kernel(kernel(word as never) as never)).toEqual(word);
});
