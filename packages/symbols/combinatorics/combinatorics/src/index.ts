// One entry point for the merged package (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 3):
// carriers, then the families typed by them.
//
// Since §4 step 5's `carrierTypes` removal (A-94), this calls each area's own `declare<Area>`
// (its own carriers, then its own families, typed by reading them back off `ce`'s registry --
// see collections/src/families/declare.ts), then `declareCollections` for the families with no
// carrier. The area order below differs from the pre-A-94 fine interleave of family chunks (see
// git history), but is observationally equivalent to it: no family or carrier declared by one
// area's chunk is shared with, or depends on, another's (A-94 verified this by tagging every
// chunk the old flat `allEntries` concatenated and checking cross-area references — zero).
// #411's finding that declaration order is load-bearing was about order ACROSS PACKAGES
// (`declareMaps` last, GaussianIntegers before combinatorics' own domains) — untouched here,
// since every host still calls `declareCombinatorics` at the same point it always did.
//
// `declareCarrierPlurals`, `declareCarrierElement` and `declareMaps` stay OUT of this call, at
// each host's own position in its own declare order:
//
// - `declareCarrierPlurals` mints a plural type-space symbol for a carrier that has no family
//   claiming it already -- `reference`'s engine never called it (or `declareCarrierElement`)
//   at all, so a bare name like `GaussianIntegers` stayed whatever `@enumeratio/number-theory`
//   later gave it. Folding it in here mints `GaussianIntegers` as `set<gaussian_integer>`
//   FIRST, ahead of that library's own declaration, and every reference example that passes
//   the symbol where a `string` carrier-tag was expected then fails a type check that used to
//   pass (caught by `packages/reference`'s `entries.test.ts`). CLI, site and census all called
//   `declareCarrierPlurals` / `declareCarrierElement` right after collections already; they keep
//   doing that themselves.
// - `declareMaps` extends shared names (`Inverse`, `Reverse`) rather than minting fresh ones.
//   `Inverse`'s permutation form is a row in its table (defineOverload), so it no longer has
//   to be declared after modular's; the hosts still call it themselves, with their constructors.
import type { ComputeEngine } from "@cortex-js/compute-engine";
import { declareCollections } from "../collections/src/index.ts";
import { declareCompositions } from "../compositions/src/declare.ts";
import { declareFindStat } from "../findstat/src/declare.ts";
import { declareGraphsArea } from "../graphs/src/declare.ts";
import { declareLatticePaths } from "../lattice-paths/src/declare.ts";
import { declarePartitions } from "../partitions/src/declare.ts";
import { declarePermutations } from "../permutations/src/declare.ts";
import { declareSetPartitions } from "../set-partitions/src/declare.ts";
import { declareTableaux } from "../tableaux/src/declare.ts";
import { declareTrees } from "../trees/src/declare.ts";
import { declareWords } from "../words/src/declare.ts";

export { CARRIERS, declareCombinatoricsCarriers, LEFTOVER_CARRIERS } from "./carriers.ts";
export { UNDEFINED_MAPS, type UndefinedMap } from "./frontier-maps.ts";
export { checkLaws, type LawFailure } from "./laws.ts";
export { type CombinatorialMap, declareMaps, evaluateDefinition, type Law, MAPS } from "./maps.ts";

/**
 * Declares the carriers and the families typed by them on `ce`: each area's own `declare<Area>`,
 * then `declareCollections` for the carrier-less families. A host no longer builds or passes
 * `carrierTypes` itself -- a family's element type is read back off `ce`'s own registry once its
 * carrier is declared, which every area does for itself before declaring its families.
 * `declareCarrierPlurals`, `declareCarrierElement` and `declareMaps` are NOT included; see the
 * file comment above.
 *
 * NOT idempotent: every constituent `declare*` throws on a name already bound in the engine's
 * scope, so calling this twice on the same `ce` throws, same as calling any of them twice today.
 */
export function declareCombinatorics(ce: ComputeEngine): void {
  declarePermutations(ce);
  declarePartitions(ce);
  declareCompositions(ce);
  declareWords(ce);
  declareLatticePaths(ce);
  declareTrees(ce);
  declareSetPartitions(ce);
  declareTableaux(ce);
  declareGraphsArea(ce);
  declareFindStat(ce);
  // A combinatorial statistic is a function of a carrier, so that is what these heads take.
  declareCollections(ce, { permutationType: "permutation" });
}
