// Dyck-path statistics' generated reference entries (step 6b: one generator per area, generic
// driver in `../../src/statistics/generate-entries.ts`). `scripts/collect-entries.ts` writes
// them into `../../reference/`; `tests/statistics-generated.test.ts` checks they're current.
//
// `MajorIndex`/`Peaks`/`Valleys` are ALSO defined on `Permutation` (permutations' own kernel):
// one head, one owner, and permutations got there first in the old combined `ALL_STATISTICS`
// order — its own generator owns those entries (with a footnote for this area's definition);
// `omitHeads` excludes them here so this generator never touches that folder.

import { fileURLToPath } from "node:url";
import type { GeneratedEntries } from "@enumeratio/entry/node";
import { areaStatisticsEntries, type Sample } from "../../src/statistics/generate-entries.ts";
import { LATTICE_PATHS_FRONTIER } from "../src/statistics.frontier.ts";
import { DYCK_STATISTICS } from "../src/statistics.ts";
import { declareLatticePaths } from "../src/declare.ts";

const SAMPLES: readonly Sample[] = [
  { list: [1, 1, 0, 0, 1, 0], caption: "the step word $UUDDUD$" },
  { list: [1, 0, 1, 1, 0, 0], caption: "the step word $UDUUDD$" },
];

export const REFERENCE_DIR = fileURLToPath(new URL("../../reference/", import.meta.url));

export const generated: { standard: GeneratedEntries; curated: GeneratedEntries } = areaStatisticsEntries({
  subjectName: "path",
  domain: "Dyck path statistics",
  definitions: DYCK_STATISTICS,
  frontier: LATTICE_PATHS_FRONTIER,
  samples: SAMPLES,
  declareArea: declareLatticePaths,
  omitHeads: ["MajorIndex", "Peaks", "Valleys"],
});
