// Every partitions-area family, re-exported by group so
// `collections/src/families/index.ts` can splice each one into `allEntries` at exactly the
// position it held before the move (§4 step 5,
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible)
// -- `referenceData()`'s family order is unchanged.
//
// A family's `carrier` still resolves to its minted element type through `declareFamilies`'
// `carrierTypes` option, same as before the move -- see the permutations pilot's
// permutations/src/families/index.ts for the full explanation.
export { entries as coreEntries } from "./core.ts";
export { entries as partitionsEntries } from "./partitions.ts";
export { entries as tableauxPlaneEntries, IsSkewPartitionOf, skewPart } from "./tableaux-plane.ts";
