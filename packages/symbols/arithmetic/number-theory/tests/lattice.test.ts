import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareNumberTheory } from "../src/declare.ts";
import { hermiteDecomposition } from "../src/hermite.ts";

const ce = new ComputeEngine();
declareNumberTheory(ce);
const run = (expr: unknown): unknown => ce.box(expr as Parameters<ComputeEngine["box"]>[0]).evaluate().json;

test("IntegerExponent: Wolfram's valuation of an integer", () => {
  expect(run(["IntegerExponent", 2000, 5])).toBe(3);
  expect(run(["IntegerExponent", 2000])).toBe(3);
  expect(run(["IntegerExponent", -24, 2])).toBe(3);
  expect(run(["IntegerExponent", 1024, 4])).toBe(5);
  expect(run(["IntegerExponent", 0, 5])).toBe("PositiveInfinity");
  expect(run(["IntegerExponent", 10, 1])).toEqual(["IntegerExponent", 10, 1]);
});

// Pinned against Wolfram 15.0. u is unique only for square nonsingular m, so the others check
// u·m = h and |det u| = 1 rather than u itself.
test("HermiteDecomposition: Wolfram's normal form", () => {
  expect(run(["HermiteDecomposition", ["List", ["List", 2, 3, 5], ["List", 7, 11, 13], ["List", 17, 19, 23]]])).toEqual(
    [
      "List",
      ["List", ["List", 11, -3, 0], ["List", 47, -11, -1], ["List", 54, -13, -1]],
      ["List", ["List", 1, 0, 16], ["List", 0, 1, 69], ["List", 0, 0, 78]],
    ],
  );
  expect(run(["HermiteDecomposition", ["List", ["List", 0, -3], ["List", 2, 0]]])).toEqual([
    "List",
    ["List", ["List", 0, 1], ["List", -1, 0]],
    ["List", ["List", 2, 0], ["List", 0, 3]],
  ]);
  // Singular / non-square: h pinned, u only up to u·m = h with u unimodular.
  const m = [
    [4n, 6n],
    [6n, 9n],
    [2n, 1n],
  ];
  const { u, h } = hermiteDecomposition(m);
  expect(h).toEqual([
    [2n, 1n],
    [0n, 2n],
    [0n, 0n],
  ]);
  expect(u.map((row) => m[0]!.map((_, j) => row.reduce((acc, x, k) => acc + x * m[k]![j]!, 0n)))).toEqual(h);
  const [[a, b, c], [d, e, f], [g, hh, i]] = u as [bigint[], bigint[], bigint[]];
  const det = a! * (e! * i! - f! * hh!) - b! * (d! * i! - f! * g!) + c! * (d! * hh! - e! * g!);
  expect(det === 1n || det === -1n).toBe(true);
  expect((run(["HermiteDecomposition", ["List", ["List", 1, 2], ["List", 2, 4]]]) as unknown[])[2]).toEqual([
    "List",
    ["List", 1, 2],
    ["List", 0, 0],
  ]);
});
