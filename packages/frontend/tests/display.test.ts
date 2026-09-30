import { ComputeEngine, LATEX_DICTIONARY, LatexSyntax } from "@cortex-js/compute-engine";
import { indexed, makeBoxes, registerNotation, toLatex } from "@enumeratio/boxes";
import { expect, test } from "vite-plus/test";
import { displayBoxes, displayDictionary } from "../src/display.ts";
import { latexOf } from "../src/latex.ts";

const engine = (): ComputeEngine =>
  new ComputeEngine({ latexSyntax: new LatexSyntax({ dictionary: displayDictionary(LATEX_DICTIONARY) }) });

test("a kernel's display writes what the page engine would", () => {
  const ce = engine();
  const json = ["Divide", 1, ["Sqrt", 2]];
  const boxes = displayBoxes(ce, json);
  expect(toLatex(boxes.StandardForm!)).toBe(latexOf(ce, ce.box(json as never)));
  expect(boxes.TraditionalForm).toEqual(makeBoxes(json as never));
  expect(boxes.StandardForm).toEqual(["FormBox", latexOf(ce, ce.box(json as never)), "TeXForm"]);
});

test("only a list has a matrix form", () => {
  const ce = engine();
  expect(displayBoxes(ce, ["Add", "x", 1]).MatrixForm).toBeUndefined();
  expect(toLatex(displayBoxes(ce, ["List", ["List", 1, 2], ["List", 3, 4]]).MatrixForm!)).toContain("pmatrix");
});

test("TraditionalForm is makeBoxes with the notation the engine's packages registered", () => {
  const ce = engine();
  registerNotation(ce, { Widget: indexed("W") });
  expect(toLatex(displayBoxes(ce, ["Widget", 3]).TraditionalForm!)).toBe("W_3");
});
