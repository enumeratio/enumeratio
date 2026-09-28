import { ComputeEngine, LATEX_DICTIONARY, LatexSyntax } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { expandDictionaries, latexOf, NOTATIO_LATEX } from "../src/latex.ts";

const ce = new ComputeEngine({
  latexSyntax: new LatexSyntax({ dictionary: [...LATEX_DICTIONARY, ...NOTATIO_LATEX] }),
});

test("a dictionary literal spells out as its entries", () => {
  expect(expandDictionaries(["List", { dict: { a: 1, b: false, c: ["Range", 0, 3] } }])).toEqual([
    "List",
    [
      "Dictionary",
      ["KeyValuePair", { str: "a" }, 1],
      ["KeyValuePair", { str: "b" }, "False"],
      ["KeyValuePair", { str: "c" }, ["Range", 0, 3]],
    ],
  ]);
});

test("a Dictionary is written as its entries, not the empty string", () => {
  const dict = ce.box([
    "Dictionary",
    ["KeyValuePair", { str: "Width" }, 2],
    ["KeyValuePair", { str: "Bijective" }, "False"],
  ]);
  expect(dict.latex).toBe("");
  expect(latexOf(ce, dict)).toBe(
    String.raw`\left\lbrace \text{Width}\to 2,\;\text{Bijective}\to \mathrm{False}\right\rbrace`,
  );
  expect(latexOf(ce, ce.box(["Add", "x", 1]))).toBe("x+1");
});
