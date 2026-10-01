import { expect, test } from "vite-plus/test";
import { indexed, makeBoxes, notationOf, registerNotation } from "../src/index.ts";
import { toLatex } from "../src/render/index.ts";

const tex = (json: unknown, notation = {}): string => toLatex(makeBoxes(json as never, notation));

test("compute-engine's heads have their traditional notation", () => {
  expect(tex(["Add", ["Fibonacci", "n"], 1])).toBe(tex(["Add", ["Subscript", "F", "n"], 1]));
  expect(tex(["MoebiusMu", 6])).toBe("\\mu(6)");
  expect(tex(["PolyGamma", 1, "z"])).toContain("\\psi^{(1)}");
  expect(tex(["Stirling", 5, 2])).toContain("5");
});

test("TraditionalForm writes True and False as ⊤ and ⊥", () => {
  expect(tex("True")).toBe("\\top");
  expect(tex("False")).toBe("\\bot");
});

test("a package's notation reaches its heads anywhere in a tree, and a call it declines stays a call", () => {
  const owner = {};
  registerNotation(owner, { Widget: indexed("W") });
  expect(tex(["Add", ["Widget", 3], 1], notationOf(owner))).toBe(tex(["Add", ["Subscript", "W", 3], 1]));
  expect(tex(["Widget", 1, 2, 3], notationOf(owner))).toBe(tex(["Widget", 1, 2, 3]));
});

test("a power as the base is fenced, and a binomial over a list stays a call", () => {
  expect(tex(["Power", ["Power", "a", "b"], "c"])).toBe("(a^b)^c");
  expect(tex(["Binomial", ["List", 2, 3], 1])).toMatch(/^\\operatorname\{Binomial\}/);
});

test("script commands take their argument as a group, and pattern names keep their underscores", () => {
  expect(toLatex(["OverscriptBox", "n", "‾"] as never)).toBe("\\overline{n}");
  expect(toLatex(["OverscriptBox", "A", "→"] as never)).toBe("\\vec{A}");
  expect(toLatex(["UnderscriptBox", "n", "_"] as never)).toBe("\\underline{n}");
  expect(tex(["List", "_a", "__rest"])).toBe("[\\_a,\\_\\_rest]");
});
