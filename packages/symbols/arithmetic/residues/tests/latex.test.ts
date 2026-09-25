import { ComputeEngine, LATEX_DICTIONARY, LatexSyntax } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareResidues } from "../src/declare.ts";
import { RESIDUES_LATEX } from "../src/latex.ts";

// Merged as notatio's engine does: an entry for a name replaces the default one.
const redefined = new Set(RESIDUES_LATEX.map((e) => e.name));
const ce = new ComputeEngine({
  latexSyntax: new LatexSyntax({
    dictionary: [...LATEX_DICTIONARY.filter((e) => !redefined.has(e.name)), ...RESIDUES_LATEX],
  }),
});
declareResidues(ce);
const parse = (tex: string): unknown => ce.parse(tex).json;
const latex = (expr: unknown): string => ce.box(expr as Parameters<ComputeEngine["box"]>[0]).latex;

test("\\pmod is a class; \\bmod is still the remainder; \\equiv…\\pmod is still a congruence", () => {
  expect(parse("2 \\pmod{5}")).toEqual(["IntegerMod", 2, 5]);
  expect(parse("a + 1 \\pmod 5")).toEqual(["IntegerMod", ["Add", "a", 1], 5]);
  expect(parse("7 \\bmod 3")).toEqual(["Mod", 7, 3]);
  expect(parse("a \\equiv b \\pmod{n}")).toEqual(["Congruent", "a", "b", "n"]);
  expect(parse("x = 2 \\pmod{5}")).toEqual(["Congruent", "x", 2, 5]);
});

test("IntegerMod and IntegerModRing write what reads back", () => {
  for (const expr of [
    ["IntegerMod", 2, 5],
    ["IntegerMod", ["Add", "a", 1], 5],
    ["Multiply", 3, ["IntegerMod", "a", 5]],
    ["Power", ["IntegerMod", 3, 7], "k"],
  ]) {
    expect(parse(latex(expr)), latex(expr)).toEqual(expr);
  }
  expect(latex(["IntegerMod", 2, 5])).toBe("2\\pmod{5}");
  expect(latex(["Power", ["IntegerMod", 3, 7], "k"])).toBe("\\left(3\\pmod{7}\\right)^{k}");
  expect(latex(["Power", ["Add", "x", 1], 2])).toBe("(x+1)^2");
  expect(latex(["IntegerModRing", 6])).toBe("\\mathbb{Z}/6\\mathbb{Z}");
  expect(ce.parse("\\mathbb{Z}/6\\mathbb{Z}").evaluate().json).toEqual(["IntegerModRing", 6]);
});

test("typed arithmetic evaluates in the ring", () => {
  const run = (tex: string): unknown => ce.parse(tex).evaluate().json;
  expect(run("\\frac{1}{3 \\pmod{7}}")).toEqual(["IntegerMod", 5, 7]);
  expect(run("(2 \\pmod{5})^{3}")).toEqual(["IntegerMod", 3, 5]);
  expect(run("3 \\pmod{4} + 3 \\pmod{4}")).toEqual(["IntegerMod", 2, 4]);
});
