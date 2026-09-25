import { entries as core } from "./core.ts";
import { entries as subsets } from "./subsets.ts";
import { entries as words } from "./words.ts";
import { entries as pathsPartitions } from "./paths-partitions.ts";
import { entries as tableauxTrees } from "./tableaux-trees.ts";
import { entries as permutations } from "./permutations.ts";
import { entries as compositions } from "./compositions.ts";
import type { FamilyKernel } from "./types.ts";

export * from "./types.ts";

// The registry of every pack. library.ts consumes `allEntries` and nothing else.
export const allEntries: readonly FamilyKernel[] = [
  ...core,
  ...subsets,
  ...words,
  ...pathsPartitions,
  ...tableauxTrees,
  ...permutations,
  ...compositions,
];
