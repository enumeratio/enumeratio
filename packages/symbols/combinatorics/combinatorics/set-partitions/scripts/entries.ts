// Set-partition statistics' generated reference entries (step 6b: one generator per area,
// generic driver in `../../src/statistics/generate-entries.ts`). `scripts/collect-entries.ts`
// writes them into `../../reference/`; `tests/statistics-generated.test.ts` checks they're
// current. No head here collides with an existing hand-written record.

import { fileURLToPath } from "node:url";
import type { GeneratedEntries } from "@enumeratio/entry/node";
import { areaStatisticsEntries, type Sample } from "../../src/statistics/generate-entries.ts";
import { SET_PARTITIONS_FRONTIER } from "../src/statistics.frontier.ts";
import { SET_PARTITION_STATISTICS } from "../src/statistics.ts";
import { declareSetPartitions } from "../src/declare.ts";

const SAMPLES: readonly Sample[] = [
  { list: [[1, 3], [2]], caption: "the partition $\\{1,3\\} \\mid \\{2\\}$" },
  { list: [[1], [2, 4], [3]], caption: "the partition $\\{1\\} \\mid \\{2,4\\} \\mid \\{3\\}$" },
];

export const REFERENCE_DIR = fileURLToPath(new URL("../../reference/", import.meta.url));

export const generated: { standard: GeneratedEntries; curated: GeneratedEntries } = areaStatisticsEntries({
  subjectName: "partition",
  domain: "Set partition statistics",
  definitions: SET_PARTITION_STATISTICS,
  frontier: SET_PARTITIONS_FRONTIER,
  samples: SAMPLES,
  declareArea: declareSetPartitions,
});
