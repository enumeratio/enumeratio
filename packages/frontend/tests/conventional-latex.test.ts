import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ComputeEngine, LatexSyntax } from "@cortex-js/compute-engine";
import { afterAll, expect, test } from "vite-plus/test";
import { conventionalLatexDictionary } from "../src/conventional-latex.ts";

// Conventional spellings for native compute-engine heads (design/upstreaming.md §8,
// old-repo issue #376): `LCM`/`MatrixRank`/`Erf` under `\operatorname{...}`, `Zeta` under
// `\zeta` not `\Zeta`. Golden JSON compared with `toEqual` (AGENTS.md); regenerate
// with `UPDATE_LATEX=1 vp test`.

const ce = new ComputeEngine({
  latexSyntax: new LatexSyntax({ dictionary: conventionalLatexDictionary() as never[] }),
});
const bare = new ComputeEngine();

const GOLDEN = fileURLToPath(new URL("./conventional-latex.golden.json", import.meta.url));
const updating = process.env.UPDATE_LATEX === "1";
const golden: Record<string, unknown> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, unknown> = {};

const record = (key: string, value: unknown): void => {
  if (updating) fresh[key] = value;
  else expect(value, key).toEqual(golden[key]);
};

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, JSON.stringify(fresh, null, 2) + "\n");
});

/** The heads this module fixes, each with an expression to serialize and the
 *  conventional LaTeX strings that should all parse back to it. */
const FIXED: { json: unknown[]; parses: string[] }[] = [
  { json: ["LCM", 4, 6], parses: ["\\operatorname{lcm}(4,6)", "\\mathrm{lcm}(4,6)"] },
  { json: ["MatrixRank", "A"], parses: ["\\operatorname{rank}(A)"] },
  { json: ["Erf", "x"], parses: ["\\operatorname{erf}(x)"] },
  { json: ["Zeta", 3], parses: ["\\zeta(3)", "\\Zeta(3)"] },
  { json: ["Beta", 2, 3], parses: ["\\mathrm{B}(2,3)", "\\Beta(2,3)"] },
];

for (const { json, parses } of FIXED) {
  const label = JSON.stringify(json);

  test(`serializes conventionally: ${label}`, () => {
    record(`serialize ${label}`, ce.box(json as never).latex);
  });

  test(`round-trips through its own serialization: ${label}`, () => {
    const latex = ce.box(json as never).latex;
    expect(ce.parse(latex).json, latex).toEqual(json);
  });

  for (const p of parses) {
    test(`parses to the fixed head: ${p}`, () => {
      expect(ce.parse(p).json, p).toEqual(json);
    });
  }
}

test("Lcm/Gcd naming: the native heads are all-caps (LCM/GCD), not TitleCase", () => {
  // See packages/symbols/combinatorics/statistics/src/permutation.ts and design/upstreaming.md §3.5 — the
  // naming incoherence this old-repo issue's "Lcm"/"Gcd" spelling predates.
  expect(!!bare.box(["LCM", 4, 6]).operatorDefinition).toBe(true);
  expect(!!bare.box(["Lcm", 4, 6]).operatorDefinition).toBe(false);
});

test("Gcd (native GCD) was already conventional -- untouched", () => {
  record("GCD serialize", ce.box(["GCD", 4, 6]).latex);
  expect(ce.box(["GCD", 4, 6]).latex).toEqual(bare.box(["GCD", 4, 6]).latex);
  expect(ce.parse("\\gcd(4,6)").json).toEqual(["GCD", 4, 6]);
});

// Written as typed (not canonicalised), so the shape under test survives boxing.
const WRITTEN: unknown[][] = [
  ["Power", ["Complex", 1, 1], 2],
  ["Square", ["Complex", 1, 1]],
  ["Power", ["Complex", 0, 1], 2],
  ["Power", ["Rational", 2, 3], 2],
  ["Power", ["Factorial", "n"], 2],
  ["Power", ["Power", "x", 2], 3],
  ["Power", ["Add", "x", 1], 2],
  ["Power", ["Rational", 2, 3], ["Rational", 1, 2]],
  ["Rational", -1, 2],
  ["Divide", ["Negate", ["Power", "Pi", 2]], 12],
  ["Divide", "x", -4],
  ["Negate", ["Rational", 3, 4]],
  ["Multiply", ["Rational", -1, 2], "x"],
  ["Add", 1, ["Rational", -1, 2]],
  ["Multiply", ["Complex", 0, 1], "Pi"],
  ["Multiply", ["Complex", 0, -1], ["Ln", "x"]],
  ["Multiply", ["Complex", 0, 2], "Pi"],
  ["Add", "a", ["Multiply", ["Complex", 0, -1], "b"]],
  ["Log", "x"],
  ["Log", "x", 2],
  ["Log10", "x"],
  ["Log2", "x"],
  ["Lb", "x"],
];

for (const json of WRITTEN) {
  test(`writes conventionally: ${JSON.stringify(json)}`, () => {
    record(`written ${JSON.stringify(json)}`, ce.box(json as never, { form: "raw" }).latex);
  });
}

test("\\mathrm{B} alone is still an upright B, and B(2, 3) is still a call to B", () => {
  expect(ce.parse("\\mathrm{B}").json).toEqual("B_upright");
  expect(ce.parse("B(2,3)").json).toEqual(["B", 2, 3]);
});

// Checked (a probe script, not a guess) and left alone: already conventional, and the
// conventional dictionary must not disturb them.
const UNCHANGED: unknown[][] = [
  ["Determinant", "A"],
  ["Trace", "A"],
  ["Sign", "x"],
  ["Arg", "x"],
  ["Mod", 4, 6],
  ["Max", 4, 6],
  ["Min", 4, 6],
  ["Sinc", "x"],
  ["Rank", "A"],
];

for (const json of UNCHANGED) {
  test(`left alone: ${JSON.stringify(json)}`, () => {
    expect(ce.box(json as never).latex).toEqual(bare.box(json as never).latex);
  });
}
