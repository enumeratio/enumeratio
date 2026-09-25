import { entries as core } from "./core.ts";
import { entries as subsets } from "./subsets.ts";
import { entries as words } from "./words.ts";
import { entries as pathsPartitions } from "./paths-partitions.ts";
import { entries as tableauxTrees } from "./tableaux-trees.ts";
import { entries as tableauxPlane } from "./tableaux-plane.ts";
import { entries as permutations } from "./permutations.ts";
import { entries as permutationClasses } from "./permutation-classes.ts";
import { entries as compositions } from "./compositions.ts";
import { entries as partitions } from "./partitions.ts";
import { entries as binaryWordFamilies } from "./binary-word-families.ts";
import { entries as numericSets } from "./numeric-sets.ts";
import { entries as numericClosedForm } from "./numeric-closed-form.ts";
import { entries as numericRecurrence } from "./numeric-recurrence.ts";
import { entries as unlabeledTrees } from "./unlabeled-trees.ts";
import type { FamilyKernel } from "./types.ts";

export * from "./types.ts";

// Every family. declare.ts declares them all; the quickcheck and OEIS scripts read them too.
export const allEntries: readonly FamilyKernel[] = [
  ...core,
  ...subsets,
  ...words,
  ...pathsPartitions,
  ...tableauxTrees,
  ...tableauxPlane,
  ...permutations,
  ...permutationClasses,
  ...compositions,
  ...partitions,
  ...binaryWordFamilies,
  ...numericSets,
  ...numericClosedForm,
  ...numericRecurrence,
  ...unlabeledTrees,
];
