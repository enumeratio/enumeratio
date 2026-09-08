// The single registry of every collection, grouped by theme. Each module exports `entries: PackEntry[]`
// (pure count/unrank/rank/valid kernels); `core` holds the originally hand-authored collections over the
// certified kernel library, the rest are grouped by mathematical family (consolidated from the
// parallel-authored packs). library.ts consumes `allEntries` and nothing else — one registration
// mechanism for all ~90 collections.
import type { PackEntry } from "./types.js";
import { entries as core } from "./core.js";

// permutations & permutation classes
import { entries as permutations } from "./permutations.js";

// compositions
import { entries as compositions } from "./compositions.js";

// partitions & set partitions
import { entries as partitions } from "./partitions.js";

// lattice paths & Catalan objects
import { entries as latticePaths } from "./lattice-paths.js";

// trees & tree-shaped functions
import { entries as trees } from "./trees.js";

// words: binary strings, restricted growth strings, necklaces/Lyndon, groupings, Gray-code subsets
import { entries as words } from "./words.js";

// subsets by size/parity/gap constraint
import { entries as subsets } from "./subsets.js";

export * from "./types.js";

export const allEntries: PackEntry[] = [
  ...(core as PackEntry[]),
  ...(permutations as PackEntry[]),
  ...(compositions as PackEntry[]),
  ...(partitions as PackEntry[]),
  ...(latticePaths as PackEntry[]),
  ...(trees as PackEntry[]),
  ...(words as PackEntry[]),
  ...(subsets as PackEntry[]),
];
