import { ComputeEngine, LATEX_DICTIONARY, LatexSyntax } from "@cortex-js/compute-engine";
import { parseEpsil, type MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { expect, test } from "vite-plus/test";
import { declareBoxes, fraction, fromMathJson, makeBoxes, row, sqrt, superscript } from "../src/index.ts";
import { BOXES_LATEX } from "../src/render/index.ts";

const ce = new ComputeEngine({ latexSyntax: new LatexSyntax({ dictionary: [...LATEX_DICTIONARY, ...BOXES_LATEX] }) });
declareBoxes(ce);

const evaluate = (src: string): MathJsonExpression => {
  const [json] = parseEpsil(src);
  return ce.box(json as never).evaluate().json as MathJsonExpression;
};

test("ToBoxes gives the boxes of the canonical form, typed boxes", () => {
  const expr = ce.box(["Divide", ["Sqrt", "x"], "y"]);
  const result = ce.box(["ToBoxes", expr.json]).evaluate();
  expect(result.type.toString()).toBe("boxes");
  expect(fromMathJson(result.json as MathJsonExpression)).toEqual(makeBoxes(expr.json as MathJsonExpression));
  expect(fromMathJson(result.json as MathJsonExpression)).toEqual(fraction(sqrt("x"), "y"));
});

test("ToBoxes evaluates its argument; MakeBoxes holds it", () => {
  expect(fromMathJson(evaluate("ToBoxes(2 + 3)"))).toEqual("5");
  expect(fromMathJson(evaluate("MakeBoxes(2 + 3)"))).toEqual(row(["2", "+", "3"]));
});

test("boxes written in Epsil are inert and read back", () => {
  expect(fromMathJson(evaluate('RowBox(["x", "+", SuperscriptBox("y", "2")])'))).toEqual(
    row(["x", "+", superscript("y", "2")]),
  );
});

test("the boxes type rejects what is not a box", () => {
  expect(JSON.stringify(ce.box(["RowBox", ["List", ["Add", "x", 1]]]).json)).toContain("incompatible-type");
  expect(JSON.stringify(ce.box(["SuperscriptBox", { str: "x" }, 2]).json)).toContain("incompatible-type");
});

test("InterpretationBox holds the expression it stands for", () => {
  expect(evaluate('InterpretationBox("F", 2 + 3)')).toEqual(["InterpretationBox", "'F'", ["Add", 2, 3]]);
});

test("DisplayForm and RawBoxes typeset as their boxes", () => {
  expect(ce.box(["DisplayForm", ["SuperscriptBox", { str: "x" }, { str: "2" }]]).latex).toBe("x^2");
  expect(makeBoxes(["Add", 1, ["RawBoxes", ["SqrtBox", { str: "y" }]]])).toEqual(row(["1", "+", sqrt("y")]));
});
