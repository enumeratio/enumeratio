import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = bareEngine();
declareCollections(ce);

// Floor/Ceil(x, step): cross-checked against the hand formula step*floor(x/step), computed
// independently in plain JS floating point. A float step gives a float (`-7.0`), so the
// values are compared.
const valueOf = (expr: unknown) => ce.box(expr as never).evaluate().re;
test("Floor(x, step) matches step*floor(x/step)", () => {
  for (const [x, step] of [
    [226, 10],
    [-10.3, 3.5],
    [17.5, 2.5],
  ] as const) {
    const expected = step * Math.floor(x / step);
    expect(valueOf(["Floor", x, step]), `Floor(${x}, ${step})`).toBe(expected);
  }
});
test("Ceil(x, step) matches step*ceil(x/step)", () => {
  for (const [x, step] of [
    [226, 10],
    [-10.3, 3.5],
    [17.5, 2.5],
  ] as const) {
    const expected = step * Math.ceil(x / step);
    expect(valueOf(["Ceil", x, step]), `Ceil(${x}, ${step})`).toBe(expected);
  }
});
