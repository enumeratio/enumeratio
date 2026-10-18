// Composition statistics' generated reference entries (step 6b: one generator per area, generic
// driver in `../../src/statistics/generate-entries.ts`). `scripts/collect-entries.ts` writes them
// into `../../reference/`; `tests/statistics-generated.test.ts` checks they're current.
//
// Ten heads are ALSO defined by another area (the partitions', permutations' or set
// partitions'), which owns their records: `omitHeads` keeps this generator out of those folders.

import { fileURLToPath } from "node:url";
import type { GeneratedEntries } from "@enumeratio/entry/node";
import { areaStatisticsEntries, type Sample } from "../../src/statistics/generate-entries.ts";
import { COMPOSITIONS_FRONTIER } from "../src/statistics.frontier.ts";
import { COMPOSITION_STATISTICS } from "../src/statistics.ts";
import { declareCompositions } from "../src/declare.ts";

const SAMPLES: readonly Sample[] = [{ list: [2, 1, 3, 1, 1], caption: "the composition $[2,1,3,1,1]$" }];

export const REFERENCE_DIR = fileURLToPath(new URL("../../reference/", import.meta.url));

export const generated: { standard: GeneratedEntries; curated: GeneratedEntries } = areaStatisticsEntries({
  subjectName: "composition",
  domain: "Composition statistics",
  definitions: COMPOSITION_STATISTICS,
  frontier: COMPOSITIONS_FRONTIER,
  samples: SAMPLES,
  declareArea: declareCompositions,
  dir: REFERENCE_DIR,
  omitHeads: [
    "Ascents",
    "DistinctMultiplicities",
    "DistinctParts",
    "Inversions",
    "MajorIndex",
    "LargestMultiplicity",
    "LargestPart",
    "LongestDecreasingSubsequence",
    "Peaks",
    "RotationOrbitSize",
  ],
});
