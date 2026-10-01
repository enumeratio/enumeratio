import { expect, test } from "vite-plus/test";
import { portableTeX, registerTeXMacros } from "../src/tex.ts";

test("MathLive-only commands become amsmath/amssymb ones", () => {
  expect(portableTeX("1+2\\imaginaryI")).toBe("1+2i");
  expect(portableTeX("\\exponentialE^{x}")).toBe("e^{x}");
  expect(portableTeX("x\\in\\Z,;n\\in\\N")).toBe("x\\in\\mathbb{Z},;n\\in\\mathbb{N}");
  expect(portableTeX("30\\degree")).toBe("30^{\\circ}");
  expect(portableTeX("\\lparen0, 1\\rbrack")).toBe("(0, 1\\rbrack");
});

test("longer commands sharing a prefix are left alone", () => {
  expect(portableTeX("\\Zeta \\Nu \\Rightarrow")).toBe("\\Zeta \\Nu \\Rightarrow");
});

test("type-error markup is unwrapped to the operand it marked", () => {
  expect(portableTeX("\\binom{\\mathtip{\\error{[2, 3]}}{\\in \\text{vector}}}{3}")).toBe("\\binom{{{[2, 3]}}}{3}");
  expect(portableTeX("\\mathrm{Clamp}(1.5, \\error{\\blacksquare})")).toBe("\\mathrm{Clamp}(1.5, {\\blacksquare})");
});

test("portableTeX spells out the hyperbolic cosecant", () => {
  expect(portableTeX("\\csch(x)")).toBe("\\operatorname{csch}(x)");
});

test("the packages' macros are expanded, arguments included", () => {
  registerTeXMacros({ permutation: "\\operatorname{Permutation}", pair: "\\langle #1, #2\\rangle" });
  expect(portableTeX("\\permutation(2, 3, 1)")).toBe("{\\operatorname{Permutation}}(2, 3, 1)");
  expect(portableTeX("\\pair{a}{\\permutation}")).toBe("{\\langle a, {\\operatorname{Permutation}}\\rangle}");
  // A longer command sharing the name is someone else's.
  expect(portableTeX("\\permutations")).toBe("\\permutations");
});
