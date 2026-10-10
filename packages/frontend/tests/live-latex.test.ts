import type { ComputeEngine } from "@cortex-js/compute-engine";
import { combineNotation } from "@enumeratio/boxes";
import { notation as combinatorics } from "@enumeratio/combinatorics/notation";
import { notation as residues } from "@enumeratio/residues/notation";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";

// A package's LaTeX notation reaches a running engine: the shared engine takes entries after it
// exists (`ce.latexSyntax.addEntries`), and reads and writes what an engine built with them does.

const NOTATION = {
  combinatorics: combineNotation([combinatorics]).latex,
  residues: combineNotation([residues]).latex,
};

const READS = [
  String.raw`\permutation([2, 3, 1])`,
  String.raw`\integerPartition([3, 2, 1])`,
  String.raw`a \pmod{n}`,
  String.raw`a = b \pmod{n}`,
  String.raw`\mathbb{Z}/5\mathbb{Z}`,
];
const WRITES: unknown[] = [
  ["Permutation", ["List", 2, 3, 1]],
  ["ResidueClass", "a", "n"],
  ["IntegerMod", "a", 5],
];

const outputs = (ce: ComputeEngine) => ({
  reads: READS.map((latex) => ce.parse(latex).json),
  writes: WRITES.map((json) => ce.latexSyntax!.serialize(json as never)),
});

type Engine = typeof import("../src/engine.ts");
let engine: Engine;
beforeEach(async () => {
  vi.resetModules();
  engine = await import("../src/engine.ts");
  engine.configureResolver({ ensure: async () => ({}), ensureAll: async () => ({}) });
});
afterEach(() => vi.resetModules());

const built = async (before: readonly (readonly unknown[])[], after: readonly (readonly unknown[])[]) => {
  for (const entries of before) engine.configureLatex(entries as never);
  const ce = await engine.loadEngineFor(["Add", 1, 2]);
  for (const entries of after) engine.configureLatex(entries as never);
  return ce;
};

test("a trigger no package has registered is not read", async () => {
  const ce = await built([], []);
  expect(JSON.stringify(ce.parse(READS[0]!).json)).not.toContain("Permutation");
});

test("entries given after the engine exists are read and written as if given before", async () => {
  const early = outputs(await built([NOTATION.combinatorics, NOTATION.residues], []));
  vi.resetModules();
  engine = await import("../src/engine.ts");
  engine.configureResolver({ ensure: async () => ({}), ensureAll: async () => ({}) });
  const late = outputs(await built([], [NOTATION.combinatorics, NOTATION.residues]));
  expect(late).toEqual(early);
  expect(JSON.stringify(late.reads[0])).toContain("Permutation");
});

test("the order packages register in does not change what is read or written", async () => {
  const forward = outputs(await built([], [NOTATION.combinatorics, NOTATION.residues]));
  vi.resetModules();
  engine = await import("../src/engine.ts");
  engine.configureResolver({ ensure: async () => ({}), ensureAll: async () => ({}) });
  const backward = outputs(await built([], [NOTATION.residues, NOTATION.combinatorics]));
  expect(backward).toEqual(forward);
});
