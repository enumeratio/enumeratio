import { ComputeEngine, LATEX_DICTIONARY, LatexSyntax } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareDomains } from "../src/declare.ts";
import { DOMAINS } from "../src/domain-data.ts";
import { carrierLatex, triggerFor } from "../src/latex.ts";
import { declareRendering } from "../src/render.ts";
import { ALL_REPRESENTATIONS, representationsFor } from "../src/representation.ts";

/** An engine whose LaTeX dictionary carries the carrier constructors. */
const engine = (): ComputeEngine => {
  const ce = new ComputeEngine({
    latexSyntax: new LatexSyntax({
      dictionary: [...LATEX_DICTIONARY, ...(carrierLatex(DOMAINS) as never[])],
    }),
  });
  declareDomains(ce);
  declareRendering(ce, Object.fromEntries(DOMAINS.map((d) => [d.type, d.name])));
  return ce;
};

const ce = engine();
const perm = (...entries: number[]): unknown => ["Permutations", ["List", ...entries]];
const text = (expr: unknown): unknown => ce.box(expr as never).evaluate().json;

function permutations(n: number): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  for (const rest of permutations(n - 1))
    for (let i = 0; i <= rest.length; i++) out.push([...rest.slice(0, i), n, ...rest.slice(i)]);
  return out;
}
const ALL = [1, 2, 3, 4].flatMap(permutations);

test("conventional notation does NOT read back on its own", () => {
  // The measurement the whole design rests on. A person reading `2\,3\,1` knows it is a
  // permutation because of the surrounding page; a parser has no such reader.
  const bare = new ComputeEngine();
  expect(bare.parse("2\\,3\\,1").json).toBe(231);
  // LaTeX parentheses are grouping, so cycle notation fares no better.
  expect(bare.parse("(1\\,2\\,3)").json).toBe(123);
});

test("the engine's own serialisation keeps a trigger, and round-trips", () => {
  for (const p of ALL) {
    const written = ce.box(perm(...p) as never).evaluate().latex;
    expect(written, `[${p}]`).toContain(triggerFor(DOMAINS.find((d) => d.name === "Permutations")!));
    expect(ce.parse(written).json, `[${p}]`).toEqual(["Permutations", ["List", ...p]]);
  }
});

test("display forms are for reading, and are reached through Render", () => {
  expect(text(["Render", perm(2, 3, 1), "'oneline'", "'latex'"])).toBe("'2\\,3\\,1'");
  expect(text(["Render", perm(2, 3, 1), "'cycle'", "'latex'"])).toBe("'(1\\,2\\,3)'");
  expect(text(["Render", ["IntegerPartitions", ["List", 3, 3, 1]], "'exponential'", "'latex'"])).toBe("'3^{2}\\,1'");
  expect(text(["Render", ["IntegerPartitions", ["List", 3, 1]], "'young'", "'latex'"])).toBe("'\\lambda = (3, 1)'");
});

test("ascii stays the default medium", () => {
  expect(text(["Render", perm(2, 3, 1), "'cycle'"])).toBe("'(1 2 3)'");
  expect(text(["Render", perm(2, 3, 1)])).toBe("'2 3 1'");
});

test("every latex representation is display-only, and says so by having no parse", () => {
  // A latex representation with a `parse` would be claiming something the measurement above
  // shows is false.
  for (const representation of ALL_REPRESENTATIONS.filter((r) => r.medium === "latex"))
    expect(representation.parse, `${representation.on}/${representation.name}`).toBeUndefined();
});

test("each carrier and medium has exactly one canonical representation", () => {
  for (const carrier of [...new Set(ALL_REPRESENTATIONS.map((r) => r.on))])
    for (const medium of ["ascii", "latex"] as const) {
      const canonical = representationsFor(carrier).filter((r) => r.medium === medium && r.canonical === true);
      expect(canonical.length, `${carrier}/${medium}`).toBe(1);
    }
});

test("a trigger is distinct per carrier", () => {
  const triggers = DOMAINS.map(triggerFor);
  expect(new Set(triggers).size).toBe(DOMAINS.length);
});
