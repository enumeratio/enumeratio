// Tree statistics' generated reference entries (step 6b: one generator per area, generic driver
// in `../../src/statistics/generate-entries.ts`). `scripts/collect-entries.ts` writes them into
// `../../reference/`; `tests/statistics-generated.test.ts` checks they're current.
//
// `Height` is ALSO defined on `DyckPath` (lattice-paths' own kernel), which owns its entry:
// `omitHeads` keeps this generator out of that folder.
//
// Four heads have a hand-written record in `../../reference/` (`curatedHeads`): their curated
// `domain`/`signature`/`summary`/`catalog`/`statOn` win and this generator only merges in
// `details`/`examples`.

import { fileURLToPath } from "node:url";
import type { GeneratedEntries } from "@enumeratio/entry/node";
import { areaStatisticsEntries, type Sample } from "../../src/statistics/generate-entries.ts";
import { TREES_FRONTIER } from "../src/statistics.frontier.ts";
import { TREE_STATISTICS } from "../src/statistics.ts";
import { declareTrees } from "../src/declare.ts";

const SAMPLES: readonly Sample[] = [
  {
    on: "BinaryTree",
    list: [
      [0, 0],
      [[0, 0], 0],
    ],
    caption: "the binary tree $[[.,.],[[.,.],.]]$",
  },
  { on: "OrderedTree", list: [[], [[]], []], caption: "the ordered tree $[[],[[]],[]]$" },
];

/** The heads with a hand-written record in `../../reference/`. */
const CURATED_HEADS: readonly string[] = ["LeftSpine", "Leaves", "RootDegree", "UnaryNodes"];

export const REFERENCE_DIR = fileURLToPath(new URL("../../reference/", import.meta.url));

export const generated: { standard: GeneratedEntries; curated: GeneratedEntries } = areaStatisticsEntries({
  subjectName: "tree",
  domain: "Tree statistics",
  definitions: TREE_STATISTICS,
  frontier: TREES_FRONTIER,
  samples: SAMPLES,
  declareArea: declareTrees,
  curatedHeads: CURATED_HEADS,
  dir: REFERENCE_DIR,
  omitHeads: ["Height"],
});
