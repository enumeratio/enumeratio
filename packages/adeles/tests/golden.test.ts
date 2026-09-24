import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareNumberTheory } from "@enumeratio/number-theory/src";
import { declareNumerals } from "@enumeratio/numerals/src";
import { declareResidues } from "@enumeratio/residues/src";
import { describe, expect, test } from "vite-plus/test";
import { declareAdeles } from "../src/declare.ts";
import golden from "./adeles.golden.json" with { type: "json" };

// Every case is pinned against Hertogh's Sage `adeles` (scripts/collect-golden.py).

const ce = new ComputeEngine();
declareResidues(ce);
declareNumerals(ce);
declareNumberTheory(ce);
declareAdeles(ce);

const run = (expr: unknown): unknown =>
  ce.box(expr as Parameters<ComputeEngine["box"]>[0]).evaluate().json;

describe.each(Object.entries(golden))("%s", (_family, cases) => {
  test.each(cases.map((c, i) => [i, c] as const))("case %i", (_i, { input, expected }) => {
    expect(run(input)).toEqual(expected);
  });
});
