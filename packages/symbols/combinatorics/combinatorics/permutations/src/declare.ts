// Permutations' own declare (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 5, A-94):
// its carriers, then the families they type. `declareCombinatorics` calls this alongside the
// other nine areas' -- see that file for why the grouped order is safe despite differing from
// the pre-A-94 fine interleave (no family or carrier here depends on another area's).
import type { ComputeEngine } from "@cortex-js/compute-engine";
import { declareCarriers } from "@enumeratio/structures";
import { declareFamilies } from "../../collections/src/families/declare.ts";
import { numberKernel } from "../../collections/src/families/types.ts";
import { declareStats } from "../../collections/src/stats.ts";
import { declareStatistics } from "../../src/statistics/declare.ts";
import { PERMUTATIONS_CARRIERS } from "./carrier-data.ts";
import { coreFamilies, permutationClassesEntries, permutationsEntries } from "./families/index.ts";
import { PERMUTATION_STATISTICS } from "./statistics.ts";

export function declarePermutations(ce: ComputeEngine): void {
  declareCarriers(ce, PERMUTATIONS_CARRIERS, { plurals: false });
  declareFamilies(ce, [...coreFamilies, ...[...permutationsEntries, ...permutationClassesEntries].map(numberKernel)]);
  // Collections' fast permutation-statistic kernels (Inversions, Descents, …), BEFORE the
  // expr-based ones below: `declareStatistics`'s own "a kernel already claims this head" skip
  // only works if the kernel got there first (step 6b moved `declareStats`'s call site here,
  // out of the generic `declareCollections` bundle, for exactly this ordering).
  declareStats(ce, { permutationType: "permutation" });
  // Its statistics, after its own carriers and families — `domainTypes` reads back from the
  // registry the carriers call above just populated (#458).
  declareStatistics(ce, PERMUTATION_STATISTICS);
}
