// A cell answered ahead of time: the input as written, its TeX, and the answer's display as the
// kernel would show it, less the code forms.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { parseExpression } from "@enumeratio/formats/expression";
import { expect, test } from "vite-plus/test";
import { ENVIRONMENTS } from "../src/environment.ts";
import { plainJson } from "../src/graphics-rules.ts";
import { outMarkup, prerender } from "../src/prerender.ts";
import { reduce } from "../src/reduce.ts";

const ce = new ComputeEngine();

test("a recorded answer is shown as the kernel shows it, with the input kept as written", () => {
  const json = ["Add", 1, 2];
  const pre = prerender(
    ce,
    { text: JSON.stringify(json), format: "mathjson" },
    json,
    3,
    true,
    (tex) => `<b>${tex}</b>`,
  );
  expect(pre.input).toEqual({ text: '["Add",1,2]', format: "mathjson" });
  expect(pre.json).toEqual(json);
  expect(pre.json).toEqual(json);
  expect(pre.inputLatex).toBe("1+2");
  expect(pre.value).toBe(3);
  expect(pre.latex).toBe("3");
  expect(pre.html).toEqual({ input: "<b>1+2</b>", output: "<b>3</b>" });
  expect(Object.keys(pre.display.text).toSorted()).toEqual(["asciimath", "inputform"]);
  expect(pre.display.boxes.StandardForm).toBeDefined();
});

// A layout of closed formulas is drawn as a grid of leaves, as `<notatio-out>` draws it, so a
// page that shows the build's answer doesn't reflow when the element takes over.
const typeset = (tex: string): string => `{${tex}}`;
// What a kernel answers with: plain MathJSON, no source offsets.
const plain = (source: string): never => plainJson(parseExpression(source).json as never) as never;
const answer = (source: string, evaluated = true): ReturnType<typeof prerender> => {
  const json = plain(source);
  return prerender(ce, { text: source, format: "epsil" }, json, json, evaluated, typeset);
};

test("a closed Grid is also written as the grid of leaves the Out draws", () => {
  const pre = answer("Grid([[1 / 2, Sqrt(2)], [Pi, 2^10]])");
  expect(pre.visual).toMatch(/^<grid-box data-head="Grid" style="[^"]*"><form-box data-form="TraditionalForm">/);
  expect(pre.visual?.match(/<form-box /g)).toHaveLength(4);
  expect(outMarkup({ ...pre, html: pre.html! })).toBe(pre.visual);
  // It is data, so a cell that reads only the answer's JSON adopts it.
  expect(JSON.parse(JSON.stringify({ ...pre, html: undefined })).visual).toBe(pre.visual);
});

test("a layout that follows the page, or that nothing evaluated, is not written ahead", () => {
  expect(answer("Grid([[k, k^2], [1, 2]])").visual).toBeUndefined();
  expect(answer("Grid([[1 / 2, Sqrt(2)]])", false).visual).toBeUndefined();
});

test("a layout some environment would draw differently is not written ahead", () => {
  // The page's environment decides at load (a compact screen reduces a Row to a Column), so only
  // a layout every environment draws as written is the same first paint for every reader.
  const row = "Row([1 / 2, Sqrt(2)])";
  const compact = ENVIRONMENTS.find((env) => env.name === "compact")!;
  const json = plain(row);
  const differs = JSON.stringify(reduce(json, compact)) !== JSON.stringify(json);
  expect(differs).toBe(true);
  expect(answer(row).visual).toBeUndefined();
  // A Grid is one every environment draws as written.
  expect(answer("Grid([[1 / 2, Sqrt(2)]])").visual).toBeDefined();
});

test("any other answer is the standard form's leaf", () => {
  const pre = answer("1 / 2 + Sqrt(2)");
  expect(pre.visual).toBeUndefined();
  expect(outMarkup({ ...pre, html: pre.html! })).toBe(`<form-box data-form="TeXForm">{${pre.latex}}</form-box>`);
});
