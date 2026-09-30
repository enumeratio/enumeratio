import {
  entriesBeforeSurjections as coreBeforeSurjections,
  entriesBeforeDyckPaths as coreBeforeDyckPaths,
  entriesBeforeSetPartitions as coreBeforeSetPartitions,
  entriesBeforeTrees as coreBeforeTrees,
  entries as core,
} from "./core.ts";
import { entries as subsets } from "./subsets.ts";
import { entriesBeforeDyckPathsByHeight as pathsPartitionsBeforeDyckPathsByHeight } from "./paths-partitions.ts";
import { entriesAfterNonDecreasingParkingFunctions as tableauxTreesAfterNonDecreasingParkingFunctions } from "./tableaux-trees.ts";
import {
  coreFamilies as permutationsCoreFamilies,
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
import {
  coreEntries as treesCoreEntries,
  labeledEntries as treesLabeledEntries,
  rootedForestsEntries as treesRootedForestsEntries,
  unlabeledTreesEntries as treesUnlabeledTreesEntries,
  pruferSequencesEntries as treesPruferSequencesEntries,
} from "../../../trees/src/families/index.ts";
import { coreEntries as graphsCoreEntries } from "../../../graphs/src/families/index.ts";
import {
  coreSurjectionsEntries as setPartitionsSurjectionsEntries,
  coreEntries as setPartitionsCoreEntries,
  pathsPartitionsEntries as setPartitionsPathsPartitionsEntries,
  matchingsEntries as setPartitionsMatchingsEntries,
} from "../../../set-partitions/src/families/index.ts";
import {
  tableauxPlaneBeforeSkewStandardTableauxEntries,
  tableauxPlaneSkewStandardTableauxEntries,
  tableauxPlaneShiftedStandardTableauxEntries,
  tableauxPlanePlanePartitionsEntries,
  standardTableauPairsEntries,
} from "../../../tableaux/src/families/index.ts";
import { entries as binaryWordFamilies } from "./binary-word-families.ts";
import { entries as numericSets } from "./numeric-sets.ts";
import { entries as numericClosedForm } from "./numeric-closed-form.ts";
import { entries as numericRecurrence } from "./numeric-recurrence.ts";
import { entries as numericDivisor } from "./numeric-divisor.ts";
import { entries as numericDigitsPrimes } from "./numeric-digits-primes.ts";
import type { ComputeEngine } from "@cortex-js/compute-engine";
import { type AnyFamily, kernelsOn } from "./epsil.ts";
import { type FamilyKernel, numberKernel } from "./types.ts";

export * from "./types.ts";
export * from "./epsil.ts";

// Every `<area>...Entries` group below keeps the exact interior position its source file held
// before that area's move -- https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 5.
const numberEntries = [
  ...compositionsCoreEntries,
  ...partitionsCoreEntries,
  ...coreBeforeSurjections,
  ...setPartitionsSurjectionsEntries,
  ...wordsCoreEntries,
  ...coreBeforeDyckPaths,
  ...latticePathsCoreEntries,
  ...coreBeforeSetPartitions,
  ...setPartitionsCoreEntries,
  ...treesLabeledEntries,
  ...treesRootedForestsEntries,
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
  ...treesPruferSequencesEntries,
  ...wordsTableauxTreesEntries,
  ...graphsCoreEntries,
  ...tableauxTreesAfterNonDecreasingParkingFunctions,
  ...tableauxPlaneBeforeSkewStandardTableauxEntries,
  ...partitionsTableauxPlaneEntries,
  ...tableauxPlaneSkewStandardTableauxEntries,
  ...tableauxPlaneShiftedStandardTableauxEntries,
  ...standardTableauPairsEntries,
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
  ...treesUnlabeledTreesEntries,
].map(numberKernel);

// Every family: a TS kernel in the bigint contract, or an Epsil definition whose kernel belongs
// to an engine (`allKernels`). The Plausible and OEIS scripts read them. Order here is data-list
// order only -- since https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 5's `carrierTypes` removal (A-94), nothing declares this list as one call any more;
// see `collectionsEntries` below and each area's own `declare<Area>` for what does.
export const allFamilies: readonly AnyFamily[] = [...permutationsCoreFamilies, ...numberEntries];

/** Every family's kernel on `ce`. */
export const allKernels = (ce: ComputeEngine): FamilyKernel[] => kernelsOn(ce, allFamilies);

// The families with NO carrier -- native to collections, not to any combinatorics area. Every
// other entry above physically lives in, and is now declared by, its own area package; this is
// what `declareCollections` itself still declares directly.
export const collectionsEntries: readonly FamilyKernel[] = [
  ...coreBeforeSurjections,
  ...coreBeforeDyckPaths,
  ...coreBeforeSetPartitions,
  ...coreBeforeTrees,
  ...core,
  ...subsets,
  ...pathsPartitionsBeforeDyckPathsByHeight,
  ...tableauxTreesAfterNonDecreasingParkingFunctions,
  ...binaryWordFamilies,
  ...numericSets,
  ...numericClosedForm,
  ...numericRecurrence,
  ...numericDivisor,
  ...numericDigitsPrimes,
].map(numberKernel);
