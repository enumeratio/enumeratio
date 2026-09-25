// Catalog statistic names we decline to adopt verbatim.
//
// The default is to adopt the name, and the default is right far more often than it looks.
// A statistic is scoped to its carrier (namespaces.md §2.2), so a name shared with another
// function is an OVERLOAD, not a clash: `Area` on a Dyck path and Wolfram's `Area[region]`
// are the same name resolved by argument, which is what Wolfram would do too, and what the
// reference already renders as an overload set. Sharing a name costs nothing and buys the
// reader the thing they actually look for — one entry per name, several signatures under it.
//
// So a WOLFRAM COLLISION IS NOT A REASON TO RENAME. Two things are:
//
//   1. the name misdescribes its own result — a head called `Cycles` that returns an integer
//      is wrong in our vocabulary before Wolfram is mentioned at all;
//   2. the name spells a count as `NumberOf…`. Counts are spelled `…Count`, Wolfram's house
//      style (`DigitCount`, `LeafCount`, `VertexCount`) and the shorter of the two; FindStat's
//      titles say "the number of", which is where the catalog spelling comes from, and a
//      title is not a symbol.
//
// The list should stay short, and every entry should fail one of those tests.

/** Catalog stat name → the head we actually declare, with the reason in the comment. */
export const RENAMED: Readonly<Record<string, string>> = {
  // Returns the NUMBER of cycles, not the cycles — and leaves `Cycles` free for the cycle
  // decomposition itself, which is the value Wolfram's `Cycles` holds.
  Cycles: "CycleCount",
  // `NumberOf…` → `…Count`, rule 2. `OccurrencesOf213` follows its siblings
  // `OccurrencesOf123` and `OccurrencesOf132`, which the catalog already spells that way.
  NumberOfCyclesOfLength2: "TwoCycleCount",
  NumberOfCyclesOfLength3: "ThreeCycleCount",
  NumberOfOccurrencesOf213: "OccurrencesOf213",
  NumberOfStandardTableaux: "StandardTableauCount",
  NumberOfTouchPoints: "TouchPointCount",
};

/** The head a catalog name is declared under. Identity for all but the listed few. */
export const blessedName = (catalogName: string): string => RENAMED[catalogName] ?? catalogName;
