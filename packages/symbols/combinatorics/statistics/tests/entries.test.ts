import { ComputeEngine } from "@cortex-js/compute-engine";
// Buildless src subpaths: the entry tests must run without a prior `vp pack`.
import { declareCollections } from "@enumeratio/collections/src";
import { expect, test } from "vite-plus/test";
import { CARRIER_TYPES, declareCarriers } from "../scripts/carriers.ts";
import { ALL_STATISTICS } from "../src/all.ts";
import { declareStatistics } from "../src/declare.ts";
import { entries } from "../src/entries.ts";

// The order both engines use: carriers, collections (which owns the fast permutation heads),
// then the definitions with `skipDeclared`. A statistic is a function OF a carrier, so that
// is what these heads take. (@enumeratio/domains itself is NOT imported: it depends on this
// package, so reaching back would be a build cycle -- see scripts/carriers.ts.)
const ce = new ComputeEngine();
declareCarriers(ce);
declareCollections(ce, { permutationType: CARRIER_TYPES.Permutation });
declareStatistics(ce, ALL_STATISTICS, { skipDeclared: true, domainTypes: CARRIER_TYPES });

for (const entry of entries) {
  for (const example of entry.examples) {
    const label = example.aspirational ? " (gap)" : "";
    test(`${entry.name} example/${example.id}${label}`, () => {
      const input = example.expr as unknown as Parameters<ComputeEngine["box"]>[0];
      const output = ce.box(input).evaluate().json;
      // A frontier head has no definition, so its example is a claim about what it WOULD
      // answer. If this starts matching, the gap closed — drop `aspirational`.
      if (example.aspirational) expect(output).not.toEqual(example.expected);
      else expect(output).toEqual(example.expected);
    });
  }
}

test("every entry names a head and a domain", () => {
  for (const entry of entries) {
    expect(entry.name).not.toBe("");
    expect(entry.domain).not.toBe("");
    expect(entry.examples.length).toBeGreaterThan(0);
  }
});
