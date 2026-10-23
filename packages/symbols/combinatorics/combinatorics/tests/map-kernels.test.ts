// A map's hand-written kernel is a fast path for its Epsil, which stays the meaning: each kernel gives the
// Epsil's answer, over every small element of its carrier and a spread of larger ones.

import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { evaluateDefinition, MAPS } from "../src/maps.ts";
import { permutations } from "./maps-helpers.ts";

const ce = bareEngine();
const list = (word: readonly number[]): unknown => ["List", ...word];

// Epsil at size 6 takes a good fraction of a second: a few spread elements there, everything below.
const SPREAD_6 = [
  [1, 2, 3, 4, 5, 6],
  [6, 5, 4, 3, 2, 1],
  [3, 1, 6, 2, 5, 4],
  [2, 4, 6, 1, 3, 5],
];

for (const map of MAPS.filter((m) => m.kernel !== undefined)) {
  test(`${map.name}'s kernel gives the Epsil's answers`, () => {
    const subjects = [
      ...[1, 2, 3, 4].flatMap((n) => permutations(n)),
      ...permutations(5).filter((_, i) => i % 7 === 0),
      ...SPREAD_6,
    ];
    for (const subject of subjects) {
      const kernel = map.kernel!(subject as never);
      expect(["List", ...(kernel as number[])], JSON.stringify(subject)).toEqual(
        evaluateDefinition(ce, map, list(subject)),
      );
    }
  });
}

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
