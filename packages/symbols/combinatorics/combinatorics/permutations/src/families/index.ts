// Every permutations-area family, re-exported by group so
// `collections/src/families/index.ts` can splice each one into `allEntries` at exactly the
// position it held before the move (§4 step 5,
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible)
// -- `referenceData()`'s family order is unchanged.
//
// A family's `carrier` (e.g. `SymmetricGroup`'s "Permutation") still resolves to its minted
// element type through `declareFamilies`' `carrierTypes` option, same as before the move:
// `declareCombinatorics` already builds that map from `CARRIERS`, which is assembled from each
// area's own carrier-data.ts (PERMUTATIONS_CARRIERS included) -- so a moved family is typed
// "directly from the area's own carrier data" at that point already, with no separate
// per-family lookup needed here. Baking a carrier's type onto the family record itself
// (bypassing the `carrierTypes` map) was tried and reverted: it broke every
// `declareCollections(ce)` caller that doesn't mint the carrier type first (24 of this
// package's own test suites), since the map lookup is what lets an untyped caller keep
// getting the bare-list collection it always got.
export { families as coreFamilies } from "./core.ts";
export { entries as permutationsEntries } from "./permutations.ts";
export { entries as permutationClassesEntries } from "./permutation-classes.ts";
