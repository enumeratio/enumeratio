import { entries as core } from "./core.ts";
import { entries as subsets } from "./subsets.ts";
import { entries as permutations } from "./permutations.ts";
import type { PackEntry } from "./types.ts";

export * from "./types.ts";

// The registry of every pack. library.ts consumes `allEntries` and nothing else.
export const allEntries: readonly PackEntry[] = [...core, ...subsets, ...permutations];
