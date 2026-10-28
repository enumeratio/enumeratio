// Catalog "statistics" that are really the SIZE OF A COLLECTION determined by the element.
//
// A fourth category, and the one that says something about naming. Such a head is not a
// statistic of an element in the way `DurfeeSquare` is — it is the cardinality of a collection
// the element indexes. Written as a statistic it reads as an oddly specific one-off; written
// as `Count(Collection(x))` it is an instance of something completely general.
//
// So these do not get definitions. They get a note saying which collection they count, and
// the machinery that already answers `Count` over a lazy collection answers them.
//
// The naming rule this suggests: a head ending `…Count` is often a cardinality wearing a
// statistic's name, and worth checking before it earns a symbol of its own.

export interface Cardinality {
  readonly head: string;
  readonly on: string;
  /** The collection whose size this is. */
  readonly counts: string;
  readonly why: string;
}

// Empty since `StandardTableauCount` (FindStat St000003), the one entry, became a statistic of an
// IntegerPartition by the hook-length formula, as `PlancherelCount` already was.
export const CARDINALITIES: readonly Cardinality[] = [];
