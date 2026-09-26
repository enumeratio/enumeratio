import { expect, test } from "vite-plus/test";
import { latexForField, latexForText, unwrapLatex } from "../src/clipboard.ts";

const asLatex = (epsil: string) => (epsil === "Sin(x) ^ 2" ? "\\sin(x)^2" : undefined);

test("delimited math unwraps to its LaTeX", () => {
  expect(unwrapLatex("$\\frac{1}{2}$")).toBe("\\frac{1}{2}");
  expect(unwrapLatex(" $$x^2$$ ")).toBe("x^2");
  expect(unwrapLatex("\\(a+b\\)")).toBe("a+b");
  expect(unwrapLatex("\\[a+b\\]")).toBe("a+b");
  expect(unwrapLatex("x + 1")).toBeUndefined();
  expect(unwrapLatex("$$")).toBeUndefined();
});

test("a math field converts only plain Epsil text", () => {
  // Epsil text becomes its LaTeX...
  expect(latexForField({ text: "Sin(x) ^ 2" }, asLatex)).toBe("\\sin(x)^2");
  // ...but a math field's own copy, delimited math and bare LaTeX go to MathLive untouched,
  expect(latexForField({ latex: "x^2", text: "Sin(x) ^ 2" }, asLatex)).toBeUndefined();
  expect(latexForField({ text: "$\\sin(x)^2$" }, asLatex)).toBeUndefined();
  expect(latexForField({ text: "\\frac{1}{2}" }, asLatex)).toBeUndefined();
  // as does text that isn't Epsil at all.
  expect(latexForField({ text: "not epsil" }, asLatex)).toBeUndefined();
  expect(latexForField({}, asLatex)).toBeUndefined();
});

test("a text editor rewrites LaTeX, and inserts anything else as it is", () => {
  expect(latexForText({ latex: "\\frac{1}{2}", text: "1 / 2" })).toEqual({ latex: "\\frac{1}{2}", maybe: false });
  expect(latexForText({ text: "$\\frac{1}{2}$" })).toEqual({ latex: "\\frac{1}{2}", maybe: false });
  // Bare LaTeX might be meant as it is -- the editor checks its own syntax first.
  expect(latexForText({ text: " \\frac{1}{2} " })).toEqual({ latex: "\\frac{1}{2}", maybe: true });
  expect(latexForText({ text: "1 / 2" })).toBeUndefined();
});
