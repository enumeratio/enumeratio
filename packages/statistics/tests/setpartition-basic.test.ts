// Block-size statistics — the cheap majority of set-partition statistics, split out of
// setpartition.test.ts (see setpartition-helpers.ts) so the expensive
// Crossings/Nestings/CrossingNestingTotal group doesn't serialize with everything else on one
// vitest worker.
import { expect, test } from "vite-plus/test";
import { SET_PARTITION_STATISTICS } from "../src/setpartition.ts";
import { checkAgainstEngine, EXPECTED } from "./setpartition-helpers.ts";

test("every set-partition definition has an independent reading", () => {
  for (const definition of SET_PARTITION_STATISTICS)
    expect(EXPECTED[definition.head], definition.head).toBeDefined();
});

checkAgainstEngine([
  "Blocks",
  "LargestBlock",
  "SmallestBlock",
  "BlockSizeSpan",
  "SingletonBlocks",
  "BlocksAtLeastTwo",
  "BlocksSizeTwo",
  "LastBlockSize",
]);
