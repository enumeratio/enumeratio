import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = new ComputeEngine();
declareCollections(ce);
const run = (expr: unknown) => ce.box(expr as never).evaluate().json;

// Partition(list, n, d, {kL, kR}): cyclic-wraparound overhangs.
test("Partition overhang {-1, 1} extends past both ends", () => {
  const result = run(["Partition", ["List", 1, 2, 3, 4, 5, 6], 5, 1, ["List", -1, 1]]) as readonly [
    string,
    ...unknown[],
  ];
  expect(result[0]).toEqual("List");
  expect(result.length - 1).toEqual(10);
});

// Flatten(list, PositiveInfinity): same as the (already fully-flattening) default.
test("Flatten(list, PositiveInfinity) fully flattens, like the default", () => {
  const nested = ["List", 1, ["List", 2, ["List", 3, ["List", 4]]]];
  expect(run(["Flatten", nested, "PositiveInfinity"])).toEqual(run(["Flatten", nested]));
});

// Join(a, b, …): any head, as long as every argument shares it.
test("Join still rejects mismatched heads (stays unevaluated)", () => {
  const result = run(["Join", ["f", "a"], ["g", "b"]]) as readonly unknown[];
  expect(result[0]).toEqual("Join");
});
