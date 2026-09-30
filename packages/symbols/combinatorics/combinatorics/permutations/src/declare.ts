// Permutations' own declare (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 5, A-94):
// its carriers, then the families they type. `declareCombinatorics` calls this alongside the
// other nine areas' -- see that file for why the grouped order is safe despite differing from
// the pre-A-94 fine interleave (no family or carrier here depends on another area's).
import type { ComputeEngine } from "@cortex-js/compute-engine";
import { declareCarriers } from "@enumeratio/structures";
import { declareFamilies } from "../../collections/src/families/declare.ts";
import { numberKernel } from "../../collections/src/families/types.ts";
import { PERMUTATIONS_CARRIERS } from "./carrier-data.ts";
import { bigintEntries, coreEntries, permutationClassesEntries, permutationsEntries } from "./families/index.ts";

export function declarePermutations(ce: ComputeEngine): void {
  declareCarriers(ce, PERMUTATIONS_CARRIERS, { plurals: false });
  declareFamilies(ce, [
    ...bigintEntries,
    ...[...coreEntries, ...permutationsEntries, ...permutationClassesEntries].map(numberKernel),
  ]);
}
