import type { Json } from "@enumeratio/engine";
import { createLatexEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { declareResidues } from "../src/declare.ts";
import { RESIDUES_LATEX } from "../src/latex.ts";

const ce = createLatexEngine(RESIDUES_LATEX, declareResidues);
const parse = (tex: string): unknown => ce.parse(tex).json;
const latex = (expr: unknown): string => ce.box(expr as Json).latex;

test("\\pmod is a class; \\bmod is still the remainder; \\equiv…\\pmod is still a congruence", () => {
  expect(parse("2 \\pmod{5}")).toEqual(["ResidueClass", 2, 5]);
  expect(parse("a + 1 \\pmod 5")).toEqual(["ResidueClass", ["Add", "a", 1], 5]);
  expect(parse("7 \\bmod 3")).toEqual(["Mod", 7, 3]);
  expect(parse("a \\equiv b \\pmod{n}")).toEqual(["Congruent", "a", "b", "n"]);
  expect(parse("x = 2 \\pmod{5}")).toEqual(["Congruent", "x", 2, 5]);
});

test("ResidueClass and QuotientRing(Integers, m) write what reads back", () => {
  for (const expr of [
    ["ResidueClass", 2, 5],
    ["ResidueClass", ["Add", "a", 1], 5],
    ["Multiply", 3, ["ResidueClass", "a", 5]],
    ["Power", ["ResidueClass", 3, 7], "k"],
  ]) {
    expect(parse(latex(expr)), latex(expr)).toEqual(expr);
  }
  // Literals are written as compute-engine writes them; a symbolic operand the way it is typed.
  expect(latex(["ResidueClass", 2, 5])).toBe("\\overline{2}_{5}");
  expect(latex(["ResidueClass", ["Add", "a", 1], 5])).toBe("a+1\\pmod{5}");
  expect(parse("\\overline{3}_{7}")).toEqual(["ResidueClass", 3, 7]);
  // compute-engine #345: `wrapPowerBase` only fences a
  // Power/Square base under a power when it ends with a superscript now, so a plain,
  // non-power base like ResidueClass gets bare parens, matching Add's below.
  expect(latex(["Power", ["ResidueClass", 3, 7], "k"])).toBe("(\\overline{3}_{7})^{k}");
  expect(latex(["Power", ["Add", "x", 1], 2])).toBe("(x+1)^2");
  const z6 = ["QuotientRing", "Integers", 6];
  expect(latex(z6)).toBe("\\mathbb{Z}/6\\mathbb{Z}");
  expect(parse(latex(z6))).toEqual(z6);
  expect(parse(latex(["QuotientRing", "Integers", ["Add", "n", 1]]))).toEqual([
    "QuotientRing",
    "Integers",
    ["Add", "n", 1],
  ]);
});

test("typed arithmetic evaluates in the ring", () => {
  const run = (tex: string): unknown => ce.parse(tex).evaluate().json;
  expect(run("\\frac{1}{3 \\pmod{7}}")).toEqual(["ResidueClass", 5, 7]);
  expect(run("(2 \\pmod{5})^{3}")).toEqual(["ResidueClass", 3, 5]);
  expect(run("3 \\pmod{4} + 3 \\pmod{4}")).toEqual(["ResidueClass", 2, 4]);
});
