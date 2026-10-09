import type { Engine } from "@enumeratio/engine";
import { declareArithHeads } from "./arith-heads.ts";
import { declareControl } from "./control.ts";
import { declareExpressionOps } from "./expression-ops.ts";
import { declareCallForms } from "./families/call-forms.ts";
import { declareFamilies } from "./families/declare.ts";
import { collectionsEntries } from "./families/index.ts";
import { declareGeneratingFunctions } from "./generating-functions.ts";
import { declareGraphs } from "./graphs.ts";
import { declareGraphs2 } from "./graphs-2.ts";
import { declareInfiniteProducts } from "./infinite-products.ts";
import { declareListFrontier } from "./list-frontier.ts";
import { declareListFrontier2 } from "./list-frontier-2.ts";
import { declareListFunctional } from "./list-functional.ts";
import { declareListHeads } from "./list-heads.ts";
import { declareListLevelHeads } from "./list-levels.ts";
import { declareListOps } from "./list-ops.ts";
import { declareListOpsWolfram } from "./list-ops-wolfram.ts";
import { declareProducts } from "./products.ts";
import { declareListStats } from "./list-stats.ts";
import { declareLogicFrontier } from "./logic-frontier.ts";
import { declareMiscFrontier } from "./misc-frontier.ts";
import { declareOperatorForms } from "./operator-forms.ts";
import { declareRoundingHeads } from "./rounding-heads.ts";

/**
 * Declare the enumeratio combinatorial collection heads on `ce` (SymmetricGroup,
 * Derangements, IntegerPartitions, KSubsets, DyckPaths, SetPartitions, BinaryTrees,
 * and many more). Each collection is a lazy indexed family answered by unranking, so
 * `Count`/`At` work without materialising it.
 *
 * Declares only the families with NO carrier (`Subsets`, `Tuples`, `Multisets`, the numeric
 * families, …) — every carrier-bearing family lives in, and is declared by, its own
 * `@enumeratio/combinatorics` area (`declare<Area>`); `declareCombinatorics` calls both. A test
 * that only needs the carrier-less heads may still call this alone.
 *
 * The fast permutation-statistic heads (Inversions, Descents, MajorIndex, …) moved out of
 * this bundle (step 6b): `declarePermutations` calls `stats.ts`'s `declareStats` itself, right
 * after its own carriers, so the fast kernel wins the name before `@enumeratio/combinatorics`'
 * own expr-based `PERMUTATION_STATISTICS` gets a turn (`declareStatistics`'s existing "a kernel
 * already claims this head" skip, unchanged). `declareStats`'s own isolated callers
 * (`collections/tests/definitions-helpers.ts`) are unaffected — they never call this function.
 */
export function declareCollections(ce: Engine): void {
  declareFamilies(ce, collectionsEntries);
  declareCallForms(ce);
  declareListOps(ce);
  declareListHeads(ce);
  declareListLevelHeads(ce);
  declareListFrontier(ce);
  declareListFrontier2(ce);
  declareListFunctional(ce);
  declareControl(ce);
  declareListOpsWolfram(ce);
  declareProducts(ce);
  declareInfiniteProducts(ce);
  declareListStats(ce);
  declareRoundingHeads(ce);
  declareArithHeads(ce);
  declareExpressionOps(ce);
  declareOperatorForms(ce);
  declareGeneratingFunctions(ce);
  declareGraphs(ce);
  declareGraphs2(ce);
  declareMiscFrontier(ce);
  declareLogicFrontier(ce);
}
