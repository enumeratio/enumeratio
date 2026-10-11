import { expect, test } from "vite-plus/test";
import { typeset } from "../src/typeset.ts";

test("display style is asked for, not assumed", () => {
  expect(typeset("x^2")).not.toContain("katex-display");
  expect(typeset("x^2", { display: true })).toContain("katex-display");
});

test("an expression's TeX is made portable first; prose TeX is left as written", () => {
  expect(typeset("\\csch x", { expression: true })).toBe(typeset("\\operatorname{csch} x"));
});

test("TeX that does not parse is shown, not thrown", () => {
  expect(typeset("\\frac{")).toContain("katex-error");
});
