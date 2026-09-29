import {
  entriesBeforeSurjections as coreBeforeSurjections,
  entriesBeforeDyckPaths as coreBeforeDyckPaths,
  entriesBeforeSetPartitions as coreBeforeSetPartitions,
  entriesBeforeTrees as coreBeforeTrees,
  entries as core,
} from "./core.ts";
import { entries as subsets } from "./subsets.ts";
import { entriesBeforeDyckPathsByHeight as pathsPartitionsBeforeDyckPathsByHeight } from "./paths-partitions.ts";
import {
  entriesBeforeParkingFunctions as tableauxTreesBeforeParkingFunctions,
  entriesAfterNonDecreasingParkingFunctions as tableauxTreesAfterNonDecreasingParkingFunctions,
} from "./tableaux-trees.ts";
import { entries as tableauxPlane } from "./tableaux-plane.ts";
import {
  bigintEntries as permutationsBigintEntries,
  coreEntries as permutationsCoreEntries,
  permutationsEntries,
  permutationClassesEntries,
} from "../../../permutations/src/families/index.ts";
import {
  coreEntries as partitionsCoreEntries,
  partitionsEntries,
  tableauxPlaneEntries as partitionsTableauxPlaneEntries,
} from "../../../partitions/src/families/index.ts";
import {
  coreEntries as compositionsCoreEntries,
  compositionsEntries,
} from "../../../compositions/src/families/index.ts";
import {
  coreEntries as wordsCoreEntries,
  wordsEntries,
  binaryWordFamiliesEntries as wordsBinaryWordFamiliesEntries,
  tableauxTreesEntries as wordsTableauxTreesEntries,
} from "../../../words/src/families/index.ts";
import {
  coreEntries as latticePathsCoreEntries,
  pathsPartitionsBeforeDyckPathsByHeightEntries as latticePathsPathsPartitionsBeforeDyckPathsByHeightEntries,
  pathsPartitionsEntries as latticePathsPathsPartitionsEntries,
} from "../../../lattice-paths/src/families/index.ts";
import { coreEntries as treesCoreEntries } from "../../../trees/src/families/index.ts";
import {
  coreSurjectionsEntries as setPartitionsSurjectionsEntries,
  coreEntries as setPartitionsCoreEntries,
  pathsPartitionsEntries as setPartitionsPathsPartitionsEntries,
  matchingsEntries as setPartitionsMatchingsEntries,
} from "../../../set-partitions/src/families/index.ts";
import {
  tableauxPlaneBeforeSkewStandardTableauxEntries,
  tableauxPlaneSkewStandardTableauxEntries,
  tableauxPlanePlanePartitionsEntries,
} from "../../../tableaux/src/families/index.ts";
import { entries as binaryWordFamilies } from "./binary-word-families.ts";
import { entries as numericSets } from "./numeric-sets.ts";
import { entries as numericClosedForm } from "./numeric-closed-form.ts";
import { entries as numericRecurrence } from "./numeric-recurrence.ts";
import { entries as numericDivisor } from "./numeric-divisor.ts";
import { entries as numericDigitsPrimes } from "./numeric-digits-primes.ts";
import { entries as unlabeledTrees } from "./unlabeled-trees.ts";
import { type FamilyKernel, numberKernel } from "./types.ts";

export * from "./types.ts";

// Every `<area>...Entries` group below keeps the exact interior position its source file held
// before that area's move -- https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 5.
const numberEntries = [
  ...permutationsCoreEntries,
  ...compositionsCoreEntries,
  ...partitionsCoreEntries,
  ...coreBeforeSurjections,
  ...setPartitionsSurjectionsEntries,
  ...wordsCoreEntries,
  ...coreBeforeDyckPaths,
  ...latticePathsCoreEntries,
  ...coreBeforeSetPartitions,
  ...setPartitionsCoreEntries,
  ...coreBeforeTrees,
  ...treesCoreEntries,
  ...core,
  ...subsets,
  ...wordsEntries,
  ...setPartitionsPathsPartitionsEntries,
  ...setPartitionsMatchingsEntries,
  ...latticePathsPathsPartitionsBeforeDyckPathsByHeightEntries,
  ...pathsPartitionsBeforeDyckPathsByHeight,
  ...latticePathsPathsPartitionsEntries,
  ...tableauxTreesBeforeParkingFunctions,
  ...wordsTableauxTreesEntries,
  ...tableauxTreesAfterNonDecreasingParkingFunctions,
  ...tableauxPlaneBeforeSkewStandardTableauxEntries,
  ...partitionsTableauxPlaneEntries,
  ...tableauxPlaneSkewStandardTableauxEntries,
  ...tableauxPlane,
  ...tableauxPlanePlanePartitionsEntries,
  ...permutationsEntries,
  ...permutationClassesEntries,
  ...compositionsEntries,
  ...partitionsEntries,
  ...wordsBinaryWordFamiliesEntries,
  ...binaryWordFamilies,
  ...numericSets,
  ...numericClosedForm,
  ...numericRecurrence,
  ...numericDivisor,
  ...numericDigitsPrimes,
  ...unlabeledTrees,
].map(numberKernel);

// Every family, in the bigint contract. declare.ts declares them all; the Plausible and OEIS
// scripts read them too.
export const allEntries: readonly FamilyKernel[] = [...permutationsBigintEntries, ...numberEntries];
