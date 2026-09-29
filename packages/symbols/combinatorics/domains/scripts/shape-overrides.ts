// Where this project stores a carrier differently from enumeratio's SQL composite type, and the
// carriers it adds. scripts/extract.ts applies both.
//
// A set partition is its blocks: the collections, every set-partition statistic and FindStat
// all read it that way. Its restricted growth string, the SQL storage, is a carrier of its own,
// order-isomorphic to it (the k-th set partition's string is the k-th string), and the two are
// joined by `RestrictedGrowthStringOf`/`SetPartitionOf` (src/map.ts).
export const SHAPE_OVERRIDES: Readonly<Record<string, string>> = {
  set_partition: "list<list<integer>>",
};

/** Carriers with no SQL composite type of their own: `[id, shape, plural]`. */
export const ADDED_CARRIERS: readonly (readonly [id: string, shape: string, plural: string])[] = [
  ["restricted_growth_string", "list<integer>", "RestrictedGrowthStrings"],
];
