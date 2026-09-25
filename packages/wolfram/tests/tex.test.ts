import { expect, test } from "vite-plus/test";
import { fromWolframTeX, toWolframTeX } from "../src/tex.ts";

// [Wolfram's TeXForm, notatio's TeX], each translating to the other.
const BOTH: readonly (readonly [string, string])[] = [
  ["\\log (2)+\\log (3)", "\\ln (2)+\\ln (3)"],
  ["\\sin ^{-1}(0)", "\\arcsin(0)"],
  ["\\text{sech}^{-1}(x)", "\\mathrm{arsech}(x)"],
  ["\\sin ^2(x)", "\\sin(x)^{2}"],
  ["\\text{Length}[\\{1,2\\}]", "\\operatorname{Length}(\\lbrack 1,2\\rbrack )"],
  ["\\text{Union}[\\{1,2\\}]", "\\lbrace 1,2\\rbrace"],
  ["\\text{ComplexInfinity}", "\\tilde\\infty"],
  ["\\Omega (8)\\geq \\nu (8)", "\\Omega (8)\\ge \\omega (8)"],
  ["\\phi (7)", "\\varphi (7)"],
  ["| 3-8|", "\\vert 3-8\\vert "],
  ["\\binom{2\\ 5}{5}", "\\binom{2\\times 5}{5}"],
  ["(4;1,2,1)", "\\binom{4}{1,2,1}"],
  ["\\mathcal{S}_{5}^{(2)}", "\\left\\lbrace\\begin{matrix}5\\\\2\\end{matrix}\\right\\rbrace"],
  ["S_{5}^{(2)}", "s(5, 2)"],
  ["\\{1,2\\}[[2]]", "\\lbrack 1,2\\rbrack [2]"],
  ["\\text{7.4$\\grave{ }$*${}^{\\wedge }$-7}", "7.4\\cdot10^{-7}"],
];

for (const [wolfram, ours] of BOTH) {
  test(`${wolfram} ⇄ ${ours}`, () => {
    expect(fromWolframTeX(wolfram).replace(/\s+/g, "")).toBe(ours.replace(/\s+/g, ""));
    expect(toWolframTeX(ours).replace(/\s+/g, "")).toBe(wolfram.replace(/\s+/g, ""));
  });
}

test("a matrix is a list of equal-length lists", () => {
  const wolfram = "\\left( \\begin{array}{cc}  1 & 2 \\\\  3 & 4 \\\\ \\end{array} \\right)";
  expect(fromWolframTeX(wolfram).replace(/\s+/g, "")).toBe("\\lbrack\\lbrack1,2\\rbrack,\\lbrack3,4\\rbrack\\rbrack");
  expect(
    toWolframTeX("\\bigl\\lbrack\\bigl\\lbrack1, 2\\bigr\\rbrack, \\bigl\\lbrack3, 4\\bigr\\rbrack\\bigr\\rbrack"),
  ).toBe("\\left(\\begin{array}{cc}1 & 2 \\\\ 3 & 4 \\\\ \\end{array}\\right)");
  expect(toWolframTeX("\\lbrack\\lbrack1, 2\\rbrack, \\lbrack3\\rbrack\\rbrack")).toBe("\\{\\{1, 2\\}, \\{3\\}\\}");
});

test("a head's name, in compute-engine's spelling and notatio's", () => {
  expect(fromWolframTeX("\\text{SquareFreeQ}[10]")).toBe("\\operatorname{IsSquareFree}(10)");
  expect(fromWolframTeX("N\\left[\\sinh (1)\\right]")).toBe("\\operatorname{N}\\left(\\sinh (1)\\right)");
  expect(fromWolframTeX("\\text{Scan}[f,\\text{Plus}]")).toBe("\\operatorname{Scan}(f,\\operatorname{Add})");
  expect(fromWolframTeX("\\text{enumeratio$\\grave{ }$Scan}")).toBe("\\text{Scan}");
  const heads = new Map([["Round", "\\mathrm{round}"]]);
  expect(fromWolframTeX("\\text{Round}[3.5]", { heads })).toBe("\\mathrm{round}(3.5)");
  expect(toWolframTeX("\\mathrm{round}(3.5)", { heads })).toBe("\\text{Round}[3.5]");
  expect(toWolframTeX("\\mathrm{IsSquareFree}(10)")).toBe("\\text{SquareFreeQ}[10]");
});

test("one way only: the spellings Wolfram chooses by the shape of the held input", () => {
  expect(fromWolframTeX("\\exp (1)")).toBe("e^{1}");
  expect(fromWolframTeX("\\exp (x+1)")).toBe("\\exp (x+1)");
  expect(fromWolframTeX("(4^{\\frac{1}{2}} \\bmod 7)")).toBe("(\\sqrt{4} \\bmod 7)");
  expect(fromWolframTeX("27^{\\frac{1}{3}}")).toBe("\\sqrt[3]{27}");
  expect(fromWolframTeX("(2^{-1} \\bmod 7)")).toBe("(\\frac{1}{2} \\bmod 7)");
  expect(fromWolframTeX("L_4 L_6-\\left(L_5\\right){}^2")).toBe("L_4 L_6-L_5^2");
  expect(fromWolframTeX("\\text{1.$\\grave{ }$20.}")).toBe("1");
});

test("left alone: a based \\log, a command's argument, words that start with a command", () => {
  expect(fromWolframTeX("\\log _2(8)")).toBe("\\log _2(8)");
  expect(fromWolframTeX("\\text{erf}^{-1}(0)")).toBe("\\text{erf}^{-1}(0)");
  expect(fromWolframTeX("\\text{log$\\Gamma $}(5)")).toBe("\\log\\Gamma(5)");
  expect(toWolframTeX("\\lnot p")).toBe("\\neg p");
  expect(toWolframTeX("\\log_{2}(8)")).toBe("\\log_{2}(8)");
});
