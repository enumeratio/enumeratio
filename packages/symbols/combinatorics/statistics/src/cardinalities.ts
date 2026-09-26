// Catalog "statistics" that are really the SIZE OF A COLLECTION determined by the element.
//
// A fourth category, and the one that says something about naming. `StandardTableauCount`
// is not a statistic of a partition in the way `DurfeeSquare` is — it is the cardinality of
// `StandardTableaux(λ)`, a collection the partition indexes. Written as a statistic it reads
// as an oddly specific one-off; written as `Count(StandardTableaux(λ))` it is an instance of
// something completely general.
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

export const CARDINALITIES: readonly Cardinality[] = [
  {
    head: "StandardTableauCount",
    on: "IntegerPartitions",
    counts: "StandardTableaux",
    why: "The size of StandardTableaux(λ), not a property of λ's diagram. The hook-length formula is one way to compute that size; Count over the collection is another, and neither belongs in a statistics table.",
  },
];
