import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { applyPatch, rangeBigBounds } from "../src/index.ts";

const ce = new ComputeEngine();
applyPatch(ce, rangeBigBounds);

const big = 2n ** 225n;
const materialized = (expr: unknown): unknown => ce.box(expr as never).evaluate({ materialization: true }).json;
const num = (n: bigint): unknown => ({ num: n.toString() });

test("a range past 2^53 keeps its consecutive integers", () => {
  expect(materialized(["Range", ["Power", 2, 225], ["Add", 5, ["Power", 2, 225]]])).toEqual([
    "List",
    ...[0n, 1n, 2n, 3n, 4n, 5n].map((k) => num(big + k)),
  ]);
});

test("count, element access and a step are exact", () => {
  const range = ce.box(["Range", ["Power", 2, 225], ["Add", 6, ["Power", 2, 225]], 2]).evaluate();
  expect(range.count).toBe(4);
  expect(ce.box(["At", range, 4]).evaluate().json).toEqual(num(big + 6n));
  expect(materialized(["Range", ["Add", 4, ["Power", 2, 225]], ["Power", 2, 225], -2])).toEqual([
    "List",
    ...[4n, 2n, 0n].map((k) => num(big + k)),
  ]);
});

test("a step against the direction, or a zero step, gives an empty range", () => {
  const count = (step: number): number | bigint | undefined =>
    ce.box(["Range", ["Add", 5, ["Power", 2, 225]], ["Power", 2, 225], step]).evaluate().count;
  expect(count(1)).toBe(0);
  expect(count(0)).toBe(0);
});

test("a range within 2^53 is untouched", () => {
  expect(materialized(["Range", 1, 10, 3])).toEqual(["List", 1, 4, 7, 10]);
  expect(materialized(["Range", 0, ["Rational", 1, 2], ["Rational", 1, 4]])).toEqual([
    "List",
    0,
    ["Rational", 1, 4],
    ["Rational", 1, 2],
  ]);
});
