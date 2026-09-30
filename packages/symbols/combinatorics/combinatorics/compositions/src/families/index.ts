// Every compositions-area family, re-exported by group so
// `collections/src/families/index.ts` can splice each one into `allEntries` at exactly the
// position it held before the move (§4 step 5,
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible)
// -- `referenceData()`'s family order is unchanged.
export { families as coreFamilies } from "./core.ts";
export { entries as compositionsEntries } from "./compositions.ts";
