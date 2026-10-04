import { box, type Json } from "@enumeratio/engine";
import { createEngine } from "@enumeratio/engine/testing";
import { declareNumberTheory } from "@enumeratio/number-theory";
import { declareNumerals } from "@enumeratio/numerals";
import { declareResidues } from "@enumeratio/residues";
import { describe, expect, test } from "vite-plus/test";
import { declareAdeles } from "../src/declare.ts";
import golden from "./adeles.golden.json" with { type: "json" };

// Every case is pinned against Hertogh's Sage `adeles` (scripts/collect-golden.py).

const ce = createEngine(declareResidues, declareNumerals, declareNumberTheory, declareAdeles);

const run = (expr: unknown): unknown => box(ce, expr as Json).evaluate().json;

describe.each(Object.entries(golden))("%s", (_family, cases) => {
  test.each(cases.map((c, i) => [i, c] as const))("case %i", (_i, { input, expected }) => {
    expect(run(input)).toEqual(expected);
  });
});
