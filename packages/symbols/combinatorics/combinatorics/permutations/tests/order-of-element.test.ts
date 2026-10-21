import { createEngine } from "@enumeratio/engine/testing";
import { declareStructures } from "@enumeratio/structures";
import { expect, test } from "vite-plus/test";
import { declarePermutations } from "../src/declare.ts";
import { permutations } from "./permutation-helpers.ts";

const ce = createEngine(declareStructures, declarePermutations);

// Brute force: compose the word with itself until it is the identity.
const bruteOrder = (word: readonly number[]): number => {
  let power = word;
  for (let n = 1; ; n++) {
    if (power.every((v, i) => v === i + 1)) return n;
    power = power.map((v) => word[v - 1]!);
  }
};

test("OrderOfElement of a permutation is its order in the symmetric group", () => {
  for (const word of [1, 2, 3, 4, 5].flatMap(permutations)) {
    const p = ["Permutation", ["List", ...word]];
    const order = ce.box(["OrderOfElement", p] as never).evaluate().json;
    expect(order).toEqual(bruteOrder(word));
    expect(ce.box(["PermutationOrder", p] as never).evaluate().json).toEqual(order);
  }
});
