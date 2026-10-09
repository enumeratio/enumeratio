import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { makeBoxes, notationOf } from "@enumeratio/boxes";
import { toLatex } from "@enumeratio/boxes/render";
import { afterAll, expect, test } from "vite-plus/test";
import { declaredEngine } from "../../reference/scripts/engines.ts";

// TraditionalForm: `makeBoxes` with the notation every package registers when it declares.
// Golden JSON compared with `toEqual` (AGENTS.md); regenerate with `UPDATE_NOTATION=1 vp test`.

const NOTATION = notationOf(declaredEngine());
const tex = (json: unknown): string => toLatex(makeBoxes(json as never, NOTATION));

const GOLDEN = fileURLToPath(new URL("./notation.golden.json", import.meta.url));
const updating = process.env.UPDATE_NOTATION === "1";
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
  ["HermiteH", "n", "x"],
  ["LaguerreL", "n", "x"],
  ["LaguerreL", "n", "a", "x"],
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
  // Bases that aren't a symbol or a non-negative integer are parenthesised.
  ["RisingFactorial", ["Complex", 2, 5], ["Complex", 3, 2]],
  ["RisingFactorial", ["Rational", 1, 2], 3],
  ["FallingFactorial", -3, 2],
  ["FallingFactorial", 1.5, 2],
  ["ModularInverse", -3, 7],
  ["Subfactorial", ["Rational", 1, 2]],
  ["Multinomial", 1, 2, 1],
  ["Stirling", 5, 2],
  ["StirlingS1", 5, 2],
  ["Subfactorial", ["Add", "n", 1]],
  ["List", "True", "False"],
  // enumeratio's own heads.
  ["IntegerExponent", 2000, 5],
  ["AdicValuation", ["AdicNumeral", 5, 75]],
  ["AdicNorm", ["AdicNumeral", 5, 75]],
  ["CliffordAlgebra", 2, 1],
  ["MulticomplexAlgebra", 2],
  ["AlgebraDimension", ["CliffordAlgebra", 2, 1]],
  ["PartitionAlgebra", 3],
  ["PlanarPartitionAlgebra", 3],
  ["BrauerAlgebra", 3, "delta"],
  ["TemperleyLiebAlgebra", 4],
  ["MotzkinAlgebra", 3],
  ["RookAlgebra", 3],
  ["SymmetricGroupAlgebra", 5],
  ["HeckeAlgebra", 4, "q"],
  ["HeckeT", ["List", 2, 1, 3], "q"],
  ["QSymM", ["List", 1, 2]],
  ["QSymF", ["List", 2]],
  ["NSymH", ["List"]],
  ["NSymR", ["List", 1, 1]],
  ["Coproduct", ["QSymM", ["List", 1, 2]]],
  ["Counit", ["NSymH", ["List"]]],
  ["Antipode", ["QSymM", ["List", 1]]],
  ["HopfTensor", ["QSymM", ["List"]], ["QSymM", ["List", 1, 2]]],
  ["DivisorLattice", 30],
  ["BooleanLattice", 3],
  ["Chain", 4],
  ["IncidenceAlgebra", ["BooleanLattice", 3]],
  ["MoebiusFunction", ["DivisorLattice", 30], 1, 30],
  ["LinearQuiver", 4],
  ["PathAlgebra", ["LinearQuiver", 4]],
  ["CyclicGroup", 6],
  ["DihedralGroup", 4],
  ["GroupDirectProduct", ["CyclicGroup", 2], ["CyclicGroup", 3]],
  ["GroupAlgebra", ["DihedralGroup", 4]],
  ["GroupOrder", ["DihedralGroup", 4]],
  ["ModularMatrix", 1, 1, 0, 1],
  ["DedekindSum", 4, 3],
  ["FormClassNumber", 60],
  ["RademacherPhi", ["ModularMatrix", 1, 7, 0, 1]],
  ["RademacherSymbol", "'LRRRR'"],
  ["Braid", 3, ["List", 1, -2, 1]],
  ["BraidPower", ["Braid", 3, ["List", 1, -2]], 2],
  ["TorusBraid", 2, 5],
  ["PretzelKnot", 2, 1, 1],
  ["AlexanderPolynomial", ["TorusBraid", 2, 3]],
  ["JonesPolynomial", ["Braid", 2, ["List", 1, 1, 1]]],
  ["KauffmanBracket", ["Braid", 2, ["List", 1]]],
  ["SeifertGenus", ["TorusBraid", 3, 4]],
  ["BraidWrithe", ["Braid", 3, ["List", 1, -2, 1]]],
];

test("every head with a notation has a call here", () => {
  const called = new Set(CALLS.map((c) => (c as unknown[])[0]));
  for (const head of Object.keys(NOTATION)) expect(called.has(head), head).toBe(true);
});

for (const json of CALLS) {
  const label = JSON.stringify(json);
  test(`notation: ${label}`, () => {
    const written = tex(json);
    if (updating) fresh[label] = written;
    else expect(written, label).toEqual(golden[label]);
  });
}

test("nested heads are reached, not only the root", () => {
  expect(tex(["Add", ["Fibonacci", "n"], 1])).toBe(tex(["Add", ["Subscript", "F", "n"], 1]));
});

test("a call threaded over a list stays a call", () => {
  expect(tex(["Fibonacci", ["List", 1, 2]])).toMatch(/^\\operatorname\{Fibonacci\}\(/);
});
