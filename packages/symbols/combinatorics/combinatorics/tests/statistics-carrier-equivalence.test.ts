import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareStructures } from "@enumeratio/structures";
import { expect, test } from "vite-plus/test";
import { CARRIERS, declareCombinatorics, declareMaps, MAPS } from "../src/index.ts";

// Set partitions and restricted growth strings: one structure, two carriers, joined by an order
// isomorphism, so what one defines the other reaches.
const ce = new ComputeEngine();
declareStructures(ce);
// The combinatorial statistics are declared inside `declareCombinatorics` itself now (step 6b).
declareCombinatorics(ce);
declareMaps(ce, Object.fromEntries(CARRIERS.map((c) => [c.type, c.name])));

const value = (json: unknown) => ce.box(json as never).evaluate().json;

// Every map claiming an order isomorphism: the k-th element of its source collection at size n
// goes to the k-th of its target at n + sizeOffset.
for (const map of MAPS.filter((m) => m.orderIsomorphism !== undefined)) {
  const { from, to, sizeOffset = 0 } = map.orderIsomorphism!;
  test(`${map.name} takes the k-th of ${from} to the k-th of ${to}`, () => {
    for (let n = Math.max(0, -sizeOffset); n <= 5; n++) {
      const count = value(["Count", [from, n]]) as number;
      expect(value(["Count", [to, n + sizeOffset]]), `${n}`).toEqual(count);
      for (let k = 1; k <= count; k++)
        expect(value(["CombinatorialMap", value(["At", [from, n], k]), `'${map.name}'`]), `${n}, ${k}`).toEqual(
          value(["At", [to, n + sizeOffset], k]),
        );
    }
  });
}

test("a statistic defined on set partitions answers on their growth strings", () => {
  const word = ["RestrictedGrowthString", ["List", 0, 1, 0, 2, 2]];
  expect(value(["CombinatorialStat", word, "'Blocks'"])).toEqual(3);
  expect(value(["Tally", ["CombinatorialStat", ["RestrictedGrowthStrings", 4], "'Blocks'"]])).toEqual([
    "Tuple",
    ["List", 1, 2, 3, 4],
    ["List", 1, 7, 6, 1],
  ]);
});

test("transport follows a chain of equivalences: a parent array reaches the Dyck path statistics", () => {
  // BinaryTreeParentArray -> BinaryTree -> DyckPath: the right spine of 3 nodes is UDUDUD.
  const spine = ["BinaryTreeParentArray", ["List", 0, 1, 2]];
  expect(value(["CombinatorialStat", spine, "'Height'"])).toEqual(1);
  expect(value(["Tally", ["CombinatorialStat", ["BinaryTreeParentArrays", 4], "'Peaks'"]])).toEqual([
    "Tuple",
    ["List", 4, 3, 2, 1],
    ["List", 1, 6, 6, 1],
  ]);
});
