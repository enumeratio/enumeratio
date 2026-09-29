import { compositionsEntries as coreCompositions, entries as core } from "./core.ts";
import { entries as subsets } from "./subsets.ts";
import { entries as words } from "./words.ts";
import { entries as pathsPartitions } from "./paths-partitions.ts";
import { entries as tableauxTrees } from "./tableaux-trees.ts";
import {
  entriesBeforeSkewPartitions as tableauxPlaneBeforeSkewPartitions,
  entries as tableauxPlane,
} from "./tableaux-plane.ts";
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
import { entries as compositions } from "./compositions.ts";
import { entries as binaryWordFamilies } from "./binary-word-families.ts";
import { entries as numericSets } from "./numeric-sets.ts";
import { entries as numericClosedForm } from "./numeric-closed-form.ts";
import { entries as numericRecurrence } from "./numeric-recurrence.ts";
import { entries as numericDivisor } from "./numeric-divisor.ts";
import { entries as numericDigitsPrimes } from "./numeric-digits-primes.ts";
import { entries as unlabeledTrees } from "./unlabeled-trees.ts";
import { type FamilyKernel, numberKernel } from "./types.ts";

export * from "./types.ts";

// `permutationsCoreEntries` (was core.ts's own permutation entries), `partitionsCoreEntries`
// (was core.ts's own "partitions" section) and `partitionsTableauxPlaneEntries` (was
// tableaux-plane.ts's SkewPartitions) keep the exact interior positions their source files held
// before their area moves -- https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 5.
const numberEntries = [
  ...permutationsCoreEntries,
  ...coreCompositions,
  ...partitionsCoreEntries,
  ...core,
  ...subsets,
  ...words,
  ...pathsPartitions,
  ...tableauxTrees,
  ...tableauxPlaneBeforeSkewPartitions,
  ...partitionsTableauxPlaneEntries,
  ...tableauxPlane,
  ...permutationsEntries,
  ...permutationClassesEntries,
  ...compositions,
  ...partitionsEntries,
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
