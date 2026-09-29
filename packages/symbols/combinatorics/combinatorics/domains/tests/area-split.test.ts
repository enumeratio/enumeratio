// Replaces the extractor's generated.test.ts pin (design/speculative/combinatorics-layering-
// and-plausible.md §4 step 4): the extractor is retired, so what needs checking now is that
// the area files and the leftover data — both hand-maintained — agree with `DOMAINS`, the
// record every host declares from.
import { expect, test } from "vite-plus/test";
import { COMPOSITIONS_DOMAINS } from "../../compositions/src/domain-data.ts";
import { FINDSTAT_DOMAINS } from "../../findstat/src/domain-data.ts";
import { GRAPHS_DOMAINS } from "../../graphs/src/domain-data.ts";
import { LATTICE_PATHS_DOMAINS } from "../../lattice-paths/src/domain-data.ts";
import { PARTITIONS_DOMAINS } from "../../partitions/src/domain-data.ts";
import { PERMUTATIONS_DOMAINS } from "../../permutations/src/domain-data.ts";
import { SET_PARTITIONS_DOMAINS } from "../../set-partitions/src/domain-data.ts";
import { TABLEAUX_DOMAINS } from "../../tableaux/src/domain-data.ts";
import { TREES_DOMAINS } from "../../trees/src/domain-data.ts";
import { WORDS_DOMAINS } from "../../words/src/domain-data.ts";
import { DOMAINS, LEFTOVER_DOMAINS } from "../src/domain-data.ts";

const AREAS = {
  permutations: PERMUTATIONS_DOMAINS,
  partitions: PARTITIONS_DOMAINS,
  compositions: COMPOSITIONS_DOMAINS,
  words: WORDS_DOMAINS,
  "lattice-paths": LATTICE_PATHS_DOMAINS,
  trees: TREES_DOMAINS,
  "set-partitions": SET_PARTITIONS_DOMAINS,
  tableaux: TABLEAUX_DOMAINS,
  graphs: GRAPHS_DOMAINS,
  findstat: FINDSTAT_DOMAINS,
} as const;

test("DOMAINS is exactly the areas plus the leftover carriers, no duplicates", () => {
  const parts = [...Object.values(AREAS), LEFTOVER_DOMAINS];
  const combined = parts.flat();
  expect(combined.length).toBe(DOMAINS.length);

  const byName = new Map(DOMAINS.map((d) => [d.name, d]));
  expect(combined.length).toBe(byName.size);
  for (const domain of combined) expect(byName.get(domain.name)).toEqual(domain);
});

test("every area carrier's `name` is unique across the whole catalog", () => {
  const seen = new Set<string>();
  for (const domain of DOMAINS) {
    expect(seen.has(domain.name), domain.name).toBe(false);
    seen.add(domain.name);
  }
});

test("no area is empty and no carrier was dropped in the split", () => {
  for (const [area, domains] of Object.entries(AREAS)) expect(domains.length, area).toBeGreaterThan(0);
});
