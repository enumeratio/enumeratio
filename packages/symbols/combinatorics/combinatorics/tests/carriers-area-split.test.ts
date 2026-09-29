// Replaces the extractor's generated.test.ts pin (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 4): the extractor is retired, so what needs checking now is that
// the area files and the leftover data — both hand-maintained — agree with `CARRIERS`, the
// record every host declares from.
import { expect, test } from "vite-plus/test";
import { COMPOSITIONS_CARRIERS } from "../compositions/src/carrier-data.ts";
import { FINDSTAT_CARRIERS } from "../findstat/src/carrier-data.ts";
import { GRAPHS_CARRIERS } from "../graphs/src/carrier-data.ts";
import { LATTICE_PATHS_CARRIERS } from "../lattice-paths/src/carrier-data.ts";
import { PARTITIONS_CARRIERS } from "../partitions/src/carrier-data.ts";
import { PERMUTATIONS_CARRIERS } from "../permutations/src/carrier-data.ts";
import { SET_PARTITIONS_CARRIERS } from "../set-partitions/src/carrier-data.ts";
import { TABLEAUX_CARRIERS } from "../tableaux/src/carrier-data.ts";
import { TREES_CARRIERS } from "../trees/src/carrier-data.ts";
import { WORDS_CARRIERS } from "../words/src/carrier-data.ts";
import { CARRIERS, LEFTOVER_CARRIERS } from "../src/carriers.ts";

const AREAS = {
  permutations: PERMUTATIONS_CARRIERS,
  partitions: PARTITIONS_CARRIERS,
  compositions: COMPOSITIONS_CARRIERS,
  words: WORDS_CARRIERS,
  "lattice-paths": LATTICE_PATHS_CARRIERS,
  trees: TREES_CARRIERS,
  "set-partitions": SET_PARTITIONS_CARRIERS,
  tableaux: TABLEAUX_CARRIERS,
  graphs: GRAPHS_CARRIERS,
  findstat: FINDSTAT_CARRIERS,
} as const;

test("CARRIERS is exactly the areas plus the leftover carriers, no duplicates", () => {
  const parts = [...Object.values(AREAS), LEFTOVER_CARRIERS];
  const combined = parts.flat();
  expect(combined.length).toBe(CARRIERS.length);

  const byName = new Map(CARRIERS.map((c) => [c.name, c]));
  expect(combined.length).toBe(byName.size);
  for (const carrier of combined) expect(byName.get(carrier.name)).toEqual(carrier);
});

test("every area carrier's `name` is unique across the whole catalog", () => {
  const seen = new Set<string>();
  for (const carrier of CARRIERS) {
    expect(seen.has(carrier.name), carrier.name).toBe(false);
    seen.add(carrier.name);
  }
});

test("no area is empty and no carrier was dropped in the split", () => {
  for (const [area, carriers] of Object.entries(AREAS)) expect(carriers.length, area).toBeGreaterThan(0);
});
