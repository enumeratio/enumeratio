import type { Json } from "@enumeratio/engine";
import { bareEngine, createLatexEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { CARRIERS, declareCombinatoricsCarriers } from "../src/carriers.ts";
import { carrierLatex, commandFor, triggerFor } from "../src/carrier-latex.ts";
import { notation } from "../src/notation.ts";

const ce = createLatexEngine(carrierLatex(CARRIERS), declareCombinatoricsCarriers);
const latex = (expr: unknown): string => ce.box(expr as Json).latex;
const parse = (tex: string): unknown => ce.parse(tex).json;

function permutations(n: number): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  for (const rest of permutations(n - 1))
    for (let i = 0; i <= rest.length; i++) out.push([...rest.slice(0, i), n, ...rest.slice(i)]);
  return out;
}

test("conventional notation doesn't read back on its own", () => {
  // A person reading `2\,3\,1` knows it is a permutation from the page around it; a parser
  // has no such reader, and LaTeX parentheses group rather than write cycles.
  const bare = bareEngine();
  expect(bare.parse("2\\,3\\,1").json).toBe(231);
  expect(bare.parse("(1\\,2\\,3)").json).toBe(123);
});

test("a permutation writes its trigger, and reads back", () => {
  for (const p of [1, 2, 3, 4].flatMap(permutations)) {
    const expr = ["Permutation", ["List", ...p]];
    expect(latex(expr), `[${p.join(", ")}]`).toBe(`\\permutation([${p.join(", ")}])`);
    expect(parse(latex(expr)), `[${p.join(", ")}]`).toEqual(expr);
  }
});

test("the variadic spelling is still read, and the list is what's written", () => {
  expect(parse("\\permutation(2, 3, 1)")).toEqual(["Permutation", ["List", 2, 3, 1]]);
  expect(latex(["CycleDecomposition", ["List", ["List", 1, 2], ["List", 3]]])).toBe(
    "\\cycleDecomposition([[1, 2], [3]])",
  );
});

test("list, nested-list and tuple shapes read back", () => {
  for (const expr of [
    ["IntegerPartition", ["List", 3, 3, 1]],
    ["CycleDecomposition", ["List", ["List", 1, 2], ["List", 3]]],
    ["ColoredPermutation", ["Tuple", ["List", 2, 1], ["List", 0, 1]]],
  ])
    expect(parse(latex(expr)), latex(expr)).toEqual(expr);
});

test("a constructor off its shape is written as any call is", () => {
  expect(latex(["Permutation", "x"])).toBe("\\operatorname{Permutation}(x)");
  expect(parse(latex(["Permutation", "x"]))).toEqual(["Permutation", "x"]);
});

test("each carrier has its own trigger and a macro for it", () => {
  const triggers = CARRIERS.map(triggerFor);
  expect(new Set(triggers).size).toBe(CARRIERS.length);
  expect(Object.keys(notation.macros ?? {}).toSorted()).toEqual(CARRIERS.map(commandFor).toSorted());
  expect(notation.macros?.permutation).toBe("\\operatorname{Permutation}");
});
