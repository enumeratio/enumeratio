import { createEngine } from "@enumeratio/engine/testing";
import { declareStructures } from "@enumeratio/structures";
import { expect, test } from "vite-plus/test";
import { declareResidues } from "../src/declare.ts";

const ce = createEngine(declareStructures, declareResidues);
const order = (head: string, a: number, m: number) => ce.box([head, a, m] as never).evaluate().json;

// Brute force: the least n >= 1 with a^n = 1 (mod m), or none for a non-unit.
const brute = (a: number, m: number): number | undefined => {
  let x = a % m;
  for (let n = 1; n <= m; n++) {
    if (x === 1 % m) return n;
    x = (x * a) % m;
  }
  return undefined;
};

test("OrderOfElement of a unit of Z/m is its order; a non-unit declines", () => {
  for (let m = 2; m <= 30; m++)
    for (let a = 0; a < m; a++) {
      const expected = brute(a, m);
      for (const head of ["ResidueClass", "IntegerMod"]) {
        const result = ce.box(["OrderOfElement", [head, a, m]] as never).evaluate().json;
        expect(result).toEqual(expected ?? ["OrderOfElement", [head, a, m]]);
      }
    }
});

test("OrderOfElement agrees with MultiplicativeOrder", () => {
  for (const [a, m] of [
    [3, 7],
    [10, 21],
    [5, 8],
  ] as const)
    expect(ce.box(["OrderOfElement", ["ResidueClass", a, m]] as never).evaluate().json).toEqual(
      order("MultiplicativeOrder", a, m),
    );
});
