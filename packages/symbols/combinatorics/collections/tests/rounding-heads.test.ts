import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = new ComputeEngine();
declareCollections(ce);
const run = (expr: unknown) => ce.box(expr as never).evaluate().json;

// Floor/Ceil(x, step): cross-checked against the hand formula step*floor(x/step), computed
// independently in plain JS floating point.
test("Floor(x, step) matches step*floor(x/step)", () => {
  for (const [x, step] of [
    [226, 10],
    [-10.3, 3.5],
    [17.5, 2.5],
  ] as const) {
    const expected = step * Math.floor(x / step);
    expect(run(["Floor", x, step]), `Floor(${x}, ${step})`).toEqual(expected);
  }
});
test("Ceil(x, step) matches step*ceil(x/step)", () => {
  for (const [x, step] of [
    [226, 10],
    [-10.3, 3.5],
    [17.5, 2.5],
  ] as const) {
    const expected = step * Math.ceil(x / step);
    expect(run(["Ceil", x, step]), `Ceil(${x}, ${step})`).toEqual(expected);
  }
});
