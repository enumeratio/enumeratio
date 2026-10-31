// Partition statistics' generated reference entries (step 6b: one generator per area,
// generic driver in `../../src/statistics/generate-entries.ts`). `scripts/collect-entries.ts`
// writes them into `../../reference/`; `tests/statistics-generated.test.ts` checks they're
// current. `ConjugacyClassSize` is also defined on `Permutation`, where its record is curated, so
// `omitHeads` keeps this generator out of that folder. `LargestPart` and `PartsEqualOne` are also
// defined on other carriers (plane partitions, compositions), whose examples are written by hand
// into the record, so they are `curatedHeads`.

import { fileURLToPath } from "node:url";
import type { GeneratedEntries } from "@enumeratio/entry/node";
import { areaStatisticsEntries, type Sample } from "../../src/statistics/generate-entries.ts";
import { PARTITIONS_FRONTIER } from "../src/statistics.frontier.ts";
import { PARTITION_STATISTICS } from "../src/statistics.ts";
import { declarePartitions } from "../src/declare.ts";

const SAMPLES: readonly Sample[] = [
  { list: [4, 2, 1], caption: "the partition $4 + 2 + 1$ of $7$" },
  { list: [3, 3, 1], caption: "the partition $3 + 3 + 1$ of $7$" },
];

export const REFERENCE_DIR = fileURLToPath(new URL("../../reference/", import.meta.url));

export const generated: { standard: GeneratedEntries; curated: GeneratedEntries } = areaStatisticsEntries({
  subjectName: "partition",
  domain: "Partition statistics",
  definitions: PARTITION_STATISTICS,
  frontier: PARTITIONS_FRONTIER,
  samples: SAMPLES,
  declareArea: declarePartitions,
  curatedHeads: ["LargestPart", "PartsEqualOne"],
  dir: REFERENCE_DIR,
  omitHeads: ["ConjugacyClassSize"],
});
