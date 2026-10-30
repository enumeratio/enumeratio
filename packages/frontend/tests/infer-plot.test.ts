import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { parseExpression } from "@enumeratio/formats/expression";
import { afterAll, expect, test } from "vite-plus/test";
import { inferPlot, type PlotContext } from "../src/infer-controls.ts";
import { inferProjection } from "../src/reactive.ts";
import { replotWithEngine } from "../src/symbols.ts";

// The plot each expression is drawn as: golden JSON compared with `toEqual` (AGENTS.md),
// regenerated with `UPDATE_INFER_PLOT=1 vp test` after an intended change. `null` is "no plot".
const CASES: Record<string, { src: string; ctx?: PlotContext }> = {
  "real: one variable is a curve": { src: "Sin(x)" },
  "real: any name, once typed, is an axis": { src: "Sin(t)", ctx: { types: { t: "real" } } },
  "real: untyped with letters off is real": { src: "Sin(t)" },
  "real: two variables are a surface": { src: "Sin(x) * Cos(y)" },
  "real: two variables as contours": { src: "Sin(x) * Cos(y)", ctx: { view: "contour" } },
  "real: two variables as shading": { src: "Sin(x) * Cos(y)", ctx: { view: "density" } },
  "real: three variables have no plot": { src: "x + y + t" },
  "complex: a declared complex variable is a portrait": { src: "Sin(w)", ctx: { types: { w: "complex" } } },
  "complex: z by letter": { src: "z ^ 2 - 1", ctx: { letterConventions: true } },
  "complex: z is real without the convention": { src: "z ^ 2 - 1" },
  "complex: mixed with a real has no plot": { src: "x * w", ctx: { types: { w: "complex" } } },
  "integer: a declared integer is discrete": { src: "k ^ 2", ctx: { types: { k: "integer" } } },
  "integer: n by letter": { src: "n ^ 2", ctx: { letterConventions: true } },
  "integer: two have no plot": { src: "p + q", ctx: { types: { p: "integer", q: "integer" } } },
  "letters: an unknown name is not an axis": { src: "Sin(t)", ctx: { letterConventions: true } },
  "letters: a declaration beats the letter": { src: "z + 1", ctx: { letterConventions: true, types: { z: "real" } } },
  "bound: controls are not axes": { src: "Sin(a * x)", ctx: { bound: new Set(["a"]) } },
  "names: only the named ones are axes": { src: "Sin(a * x)", ctx: { names: ["x"] } },
  "hint: a typed hint wins": { src: "Sin(m)", ctx: { hints: { m: { type: "integer" } } } },
  "no free symbols": { src: "1 + 2" },
  "list: numbers are points": { src: "[1, 4, 9, 16]" },
  "list: joined": { src: "[1, 4, 9, 16]", ctx: { joined: true } },
  "list: pairs": { src: "[[0, 1], [1, 3], [2, 2]]" },
  "list: symbolic entries have no plot": { src: "[x, 2]" },
  "value: an equation has no plot": { src: "x == 1" },
  "value: a string has no plot": { src: '"hello"' },
};

const GOLDEN = fileURLToPath(new URL("./infer-plot.golden.json", import.meta.url));
const updating = process.env.UPDATE_INFER_PLOT === "1";
const golden: Record<string, unknown> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, unknown> = {};

for (const [id, { src, ctx }] of Object.entries(CASES)) {
  test(`plots: ${id}`, () => {
    const { json, errors } = parseExpression(src);
    expect(errors).toEqual([]);
    const choice = inferPlot(json, ctx) ?? null;
    fresh[id] = choice;
    if (!updating) expect(choice).toEqual(golden[id]);
  });
}

// A Manipulate's inferred plot chosen again with an engine's declarations: what it is drawn as
// instead (`null` when the declarations change nothing). Same golden file, under `replot:`.
const ce = new ComputeEngine();
ce.declare("x", "integer");
ce.declare("y", "complex");
ce.declare("z", "real");
const REPLOTS: Record<string, { src: string; axes: string[]; controls?: string[] }> = {
  "an integer axis is points at the integers": { src: "a * x ^ 2", axes: ["x"], controls: ["a"] },
  "a complex axis is a portrait": { src: "y ^ 2 + c", axes: ["y"], controls: ["c"] },
  "a real axis beats the letter z": { src: "Sin(a * z)", axes: ["z"], controls: ["a"] },
  "undeclared stays as lowered": { src: "Sin(a * w)", axes: ["w"], controls: ["a"] },
  "mixed domains keep the lowering's plot": { src: "x * y", axes: ["x", "y"] },
};

for (const [id, { src, axes, controls }] of Object.entries(REPLOTS)) {
  test(`replot: ${id}`, () => {
    const result = replotWithEngine(src, axes, new Set(controls), ce) ?? null;
    fresh[`replot: ${id}`] = result;
    if (!updating) expect(result).toEqual(golden[`replot: ${id}`]);
  });
}

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
});

test("the sheet's projection is the letter-convention plot, on the axes its panes read", () => {
  expect(inferProjection(["y"])).toBe("none"); // a real axis, but not one the curve pane reads
  expect(inferProjection(["n"])).toBe("none"); // discrete: no pane
});
