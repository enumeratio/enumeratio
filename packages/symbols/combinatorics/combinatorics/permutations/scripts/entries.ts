// Permutation statistics' generated reference entries (step 6b: one generator per area,
// generic driver in `../../src/statistics/generate-entries.ts`). `scripts/collect-entries.ts`
// writes them into `../../reference/`; `tests/statistics-generated.test.ts` checks they're
// current.
//
// 11 heads here already have a hand-written record in `../../reference/` — `curatedHeads`
// below, from the same folders `@enumeratio/combinatorics`' own reference always had. Their
// curated `domain`/`signature`/`summary`/`signatures`/`seeAlso`/`references`/`catalog`/`statOn`
// win; this generator only merges in `details`/`examples`.
//
// `MajorIndex`/`Peaks`/`Valleys` are ALSO defined on `DyckPath` (lattice-paths' own kernel):
// one head, one owner, and permutations got there first in the old combined `ALL_STATISTICS`
// order — `shadowedBy` appends lattice-paths' own footnote here; lattice-paths' own generator
// excludes them via `omitHeads`.

import { fileURLToPath } from "node:url";
import type { GeneratedEntries } from "@enumeratio/entry/node";
import { areaStatisticsEntries, type Sample } from "../../src/statistics/generate-entries.ts";
import { PERMUTATIONS_FRONTIER } from "../src/statistics.frontier.ts";
import { PERMUTATION_STATISTICS } from "../src/statistics.ts";
import { declarePermutations } from "../src/declare.ts";
import { DYCK_STATISTICS } from "../../lattice-paths/src/statistics.ts";

const SAMPLES: readonly Sample[] = [
  { list: [3, 1, 2], caption: "the one-line word $312$" },
  { list: [2, 4, 1, 3], caption: "the one-line word $2413$" },
];

/** The heads with a hand-written record in `../../reference/`. */
const CURATED_HEADS = [
  "PermutationLength",
  "PermutationMax",
  "PermutationMin",
  "PermutationSupport",
  "Antiexcedances",
  "Ascents",
  "CycleCount",
  "Descents",
  "Excedances",
  "FixedPoints",
  "Inversions",
  "MajorIndex",
  "MinorIndex",
  "Peaks",
  "Valleys",
];

const SHADOWED_BY = DYCK_STATISTICS.filter((d) => ["MajorIndex", "Peaks", "Valleys"].includes(d.head));

export const REFERENCE_DIR = fileURLToPath(new URL("../../reference/", import.meta.url));

export const generated: { standard: GeneratedEntries; curated: GeneratedEntries } = areaStatisticsEntries({
  subjectName: "p",
  domain: "Permutation statistics",
  definitions: PERMUTATION_STATISTICS,
  frontier: PERMUTATIONS_FRONTIER,
  samples: SAMPLES,
  declareArea: declarePermutations,
  curatedHeads: CURATED_HEADS,
  dir: REFERENCE_DIR,
  shadowedBy: SHADOWED_BY,
});
