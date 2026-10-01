// A cell answered ahead of time: the input as written, its TeX, and the answer's display as the
// kernel would show it, less the code forms.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { prerender } from "../src/prerender.ts";

const ce = new ComputeEngine();

test("a recorded answer is shown as the kernel shows it, with the input kept as written", () => {
  const json = ["Add", 1, 2];
  const pre = prerender(ce, { text: JSON.stringify(json), format: "mathjson" }, json, 3, (tex) => `<b>${tex}</b>`);
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
