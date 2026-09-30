// Every tableaux-area family, re-exported by group so `collections/src/families/index.ts` can
// splice each one into `allEntries` at exactly the position it held before the move (§4 step 5,
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible)
// -- `referenceData()`'s family order is unchanged.
export {
  entriesBeforeSkewStandardTableaux as tableauxPlaneBeforeSkewStandardTableauxEntries,
  skewStandardTableauxEntries as tableauxPlaneSkewStandardTableauxEntries,
  shiftedStandardTableauxEntries as tableauxPlaneShiftedStandardTableauxEntries,
  planePartitionsEntries as tableauxPlanePlanePartitionsEntries,
} from "./tableaux-plane.ts";
