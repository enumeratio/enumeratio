// Every words-area family, re-exported by group so `collections/src/families/index.ts` can
// splice each one into `allEntries` at exactly the position it held before the move (§4 step 5,
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible)
// -- `referenceData()`'s family order is unchanged.
export { entries as coreEntries } from "./core.ts";
export { entries as wordsEntries } from "./words.ts";
export { entries as binaryWordFamiliesEntries } from "./binary-word-families.ts";
export { entries as tableauxTreesEntries } from "./tableaux-trees.ts";
