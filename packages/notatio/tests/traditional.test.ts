import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ComputeEngine, LATEX_DICTIONARY, LatexSyntax } from "@cortex-js/compute-engine";
import { afterAll, expect, test } from "vite-plus/test";
import { CONVENTIONAL_LATEX, conventionalLatexDictionary } from "../src/conventional-latex.ts";
import { mergeLatex } from "../src/engine.ts";
import { TRADITIONAL_LATEX, toTraditionalLatex } from "../src/traditional.ts";

// Traditional notation is written only when asked for; the plain spelling -- what the
// editable In shows -- is exactly what it was without these entries. Golden JSON compared with `toEqual`
// (AGENTS.md); regenerate with `UPDATE_LATEX=1 vp test`.

const ce = new ComputeEngine({
  latexSyntax: new LatexSyntax({ dictionary: conventionalLatexDictionary() as never[] }),
});

/** The same dictionary before the traditional entries joined it. */
const without = new ComputeEngine({
  latexSyntax: new LatexSyntax({
    dictionary: mergeLatex(LATEX_DICTIONARY as never[], CONVENTIONAL_LATEX as never[]),
  }),
});

const GOLDEN = fileURLToPath(new URL("./traditional.golden.json", import.meta.url));
const updating = process.env.UPDATE_LATEX === "1";
const golden: Record<string, string> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, string> = {};
afterAll(() => {
  if (updating) writeFileSync(GOLDEN, JSON.stringify(fresh, null, 2) + "\n");
});

/** One call per head in the table, at the arity its notation takes. */
const CALLS: unknown[] = [
  ["Fibonacci", "n"],
  ["Fibonacci", "n", "x"],
  ["LucasL", 10],
  ["CatalanNumber", "n"],
  ["BellNumber", 5],
  ["BernoulliB", "n", "x"],
  ["NthPrime", 10],
  ["StieltjesGamma", 0],
  ["HarmonicNumber", "n", 2],
  ["MoebiusMu", "n"],
  ["Totient", 12],
  ["PrimePi", "x"],
  ["PrimeNu", 24],
  ["PrimeOmega", 30],
  ["CarmichaelLambda", 15],
  ["DivisorSigma", 1, "n"],
  ["MultiplicativeOrder", 5, 8],
  ["PowerMod", 2, 10, 3],
  ["ModularInverse", 3, 7],
  ["JacobiSymbol", 2, 7],
  ["KroneckerSymbol", 17, 6],
  ["LegendreSymbol", 2, 7],
  ["Digamma", "z"],
  ["PolyGamma", 1, "z"],
  ["GammaLn", "x"],
  ["LogGamma", "x"],
  ["BarnesG", 5],
  ["LogBarnesG", 4],
  ["LerchPhi", "z", "s", "a"],
  ["HurwitzZeta", "s", "a"],
  ["DirichletEta", "s"],
  ["DirichletBeta", "s"],
  ["DirichletCharacter", 4, 2, 3],
  ["DirichletL", 4, 2, "s"],
  ["Erfc", "x"],
  ["ErfInv", "x"],
  ["GammaRegularized", "a", "x"],
  ["BetaRegularized", "z", "a", "b"],
  ["ClausenCl", 2, "t"],
  ["Pochhammer", "a", "n"],
  ["RisingFactorial", "x", "n"],
  ["FallingFactorial", ["Add", "x", 1], "n"],
  ["Multinomial", 1, 2, 1],
  ["Stirling", 5, 2],
  ["StirlingS1", 5, 2],
  ["Subfactorial", ["Add", "n", 1]],
  ["List", "True", "False"],
];

test("every head in the table has a call here", () => {
  const called = new Set(CALLS.map((c) => (c as unknown[])[0]));
  const constants = new Set(["True", "False"]);
  for (const { name } of TRADITIONAL_LATEX) {
    expect(called.has(name) || constants.has(name as string), name).toBe(true);
  }
});

for (const json of CALLS) {
  const label = JSON.stringify(json);
  const boxed = ce.box(json as never, { form: "raw" });

  test(`traditional: ${label}`, () => {
    const written = boxed.toLatex({ traditional: true });
    if (updating) fresh[label] = written;
    else expect(written, label).toEqual(golden[label]);
  });

  test(`plain spelling unchanged: ${label}`, () => {
    expect(boxed.latex).toEqual(without.box(json as never, { form: "raw" }).latex);
  });
}

test("nested heads are reached, not only the root", () => {
  expect(toTraditionalLatex(["Add", ["Fibonacci", "n"], 1], ce)).toBe("F_{n}+1");
});

test("a call threaded over a list keeps the functional spelling", () => {
  const listed = ce.box(["Fibonacci", ["List", 1, 2]], { form: "raw" });
  expect(listed.toLatex({ traditional: true })).toEqual(listed.latex);
});
