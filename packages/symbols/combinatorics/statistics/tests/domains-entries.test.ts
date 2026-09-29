import { ComputeEngine } from "@cortex-js/compute-engine";
// Buildless src subpaths: the entry tests must run without a prior `vp pack`.
import { declareCollections } from "@enumeratio/combinatorics/collections/src";
import { ALL_STATISTICS, declareStatistics } from "@enumeratio/statistics/src";
import { expect, test } from "vite-plus/test";
import { declareDomains, declareMaps, DOMAINS } from "@enumeratio/combinatorics/domains/src";
import { readEntries } from "@enumeratio/entry/node";

const entries = [
  // combinatorics' reference/ is now one directory shared by the collections and domains
  // areas (recordDirs wants one `reference/` per package, design/speculative/combinatorics-
  // layering-and-plausible.md's step-1 merge); this file only means to re-check the maps
  // (originally `domains/reference/`), so it filters to entries that carry a map tag.
  ...readEntries(new URL("../../combinatorics/reference/", import.meta.url)).filter(
    (entry) => entry.mapOn !== undefined,
  ),
  // structures' heads over the carriers' tables need the carriers, so they run here.
  ...readEntries(new URL("../../../../structures/reference/", import.meta.url)).filter((entry) =>
    ["CombinatorialStat", "CombinatorialMap"].includes(entry.name),
  ),
];

// The same stack both engines declare, in the same order.
const ce = new ComputeEngine();
declareDomains(ce);
const carrierTypes = Object.fromEntries(DOMAINS.map((d) => [d.name, d.type]));
declareCollections(ce, { permutationType: "permutation", carrierTypes });
declareStatistics(ce, ALL_STATISTICS, { domainTypes: carrierTypes });
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
  const maps = entries.filter((entry) => entry.mapOn !== undefined);
  expect(maps.length).toBeGreaterThan(20);
  for (const entry of maps) expect(entry.examples.length, entry.name).toBeGreaterThan(0);
});
