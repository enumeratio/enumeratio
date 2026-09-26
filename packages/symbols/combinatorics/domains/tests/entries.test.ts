import { ComputeEngine } from "@cortex-js/compute-engine";
// Buildless src subpaths: the entry tests must run without a prior `vp pack`.
import { declareCollections } from "@enumeratio/collections/src";
import { ALL_STATISTICS, declareStatistics } from "@enumeratio/statistics/src";
import { expect, test } from "vite-plus/test";
import { declareDomainConstructors, declareDomainTypes } from "../src/declare.ts";
import { DOMAINS } from "../src/domain-data.ts";
import { readEntries } from "@enumeratio/entry/node";
import { declareMaps } from "../src/map.ts";

const entries = readEntries(new URL("../reference/", import.meta.url));

// The same stack both engines declare, in the same order — but split around
// declareCollections: its `permutationType` option needs the carrier TYPE to already exist
// (declareDomainTypes), while its NAMES (a shared one like Permutations) need to declare
// before domains' own constructors do, so a name the two share overloads onto it rather
// than colliding (declareDomainConstructors, same as census/src/engine.ts's ordering).
const ce = new ComputeEngine();
declareDomainTypes(ce);
declareCollections(ce, { permutationType: "permutation" });
declareDomainConstructors(ce);
declareStatistics(ce, ALL_STATISTICS, {
  skipDeclared: true,
  // SetPartitions held back -- RGS here, blocks in the definitions. See scripts/carriers.ts.
  domainTypes: Object.fromEntries(DOMAINS.filter((d) => d.name !== "SetPartitions").map((d) => [d.name, d.type])),
});
declareMaps(ce, Object.fromEntries(DOMAINS.map((d) => [d.type, d.name])));

for (const entry of entries) {
  for (const example of entry.examples) {
    const label = example.aspirational ? " (gap)" : "";
    test(`${entry.name} example/${example.id}${label}`, () => {
      const input = example.expr as unknown as Parameters<ComputeEngine["box"]>[0];
      const output = ce.box(input).evaluate().json;
      // An undefined map has no head to call, so its example is a claim about what it WOULD
      // answer. If this starts matching, the gap closed — drop `aspirational`.
      if (example.aspirational) expect(output).not.toEqual(example.expected);
      else expect(output).toEqual(example.expected);
    });
  }
}

test("every map entry carries an example", () => {
  for (const entry of entries) expect(entry.examples.length).toBeGreaterThan(0);
});
