// Checking a map's laws is generic machinery, not combinatorics-specific — moved to
// @enumeratio/structures. Re-exported here so nothing outside this package has to know that.
export { checkLaws, type LawFailure } from "@enumeratio/structures";
