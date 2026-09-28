import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { canonicalOrder } from "../src/canonical.ts";
import type { Overload } from "../src/types.ts";

const ce = new ComputeEngine();
const order = (overloads: Overload[]): string[] => canonicalOrder(overloads, ce).map((o) => `${o.package}: ${o.type}`);

test("most specific first, down the numeric tower", () => {
  expect(
    order([
      { package: "a", type: "(number) -> number" },
      { package: "b", type: "(integer) -> integer" },
      { package: "c", type: "(real) -> real" },
    ]),
  ).toEqual(["b: (integer) -> integer", "c: (real) -> real", "a: (number) -> number"]);
});

test("the order is the same however the overloads are listed", () => {
  const overloads: Overload[] = [
    { package: "x", type: "(integer, integer) -> integer" },
    { package: "y", type: "(integer, value) -> value" },
    { package: "z", type: "(string) -> string" },
  ];
  expect(order(overloads)).toEqual(order([...overloads].toReversed()));
  expect(order(overloads)[0]).toBe("x: (integer, integer) -> integer");
});

test("an unparseable or untyped overload sorts by print, never throws", () => {
  expect(order([{ package: "p", type: "(Permutation) -> integer" }, { package: "q" }])).toEqual([
    "q: undefined",
    "p: (Permutation) -> integer",
  ]);
});
