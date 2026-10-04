import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { box, isNumber, isSymbol, type Json } from "../src/index.ts";
import { bareEngine, createEngine } from "../src/testing.ts";
import * as unstable from "../src/unstable.ts";

test("box boxes MathJSON", () => {
  const ce = bareEngine();
  const json: Json = ["Add", 1, ["Multiply", 2, 3]];
  expect(box(ce, json).evaluate().json).toBe(7);
  expect(isNumber(box(ce, 5))).toBe(true);
  expect(isSymbol(box(ce, "Pi"))).toBe(true);
});

test("createEngine applies the declares in order, on a fresh engine each time", () => {
  const order: string[] = [];
  const ce = createEngine(
    () => order.push("first"),
    (e) => {
      order.push("second");
      e.declare("Twice", { signature: "(number) -> number", evaluate: ([x]) => x!.mul(e.number(2)) });
    },
  );
  expect(order).toEqual(["first", "second"]);
  expect(box(ce, ["Twice", 4]).evaluate().json).toBe(8);
  expect(createEngine()).not.toBe(createEngine());
  expect(box(bareEngine(), ["Twice", 4]).evaluate().operator).toBe("Twice");
});

test("unstable is the one compute-engine class", () => {
  expect(unstable.ComputeEngine).toBe(ComputeEngine);
});
