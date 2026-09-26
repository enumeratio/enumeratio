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
// The list should stay short, and every entry should fail one of those tests. The renames
// made under it are data now, not a table here: each head's own `formerly:` field
// (design/speculative/symbol-metadata.md) names the catalog spelling it replaced --
// `CycleCount`'s says `Cycles` (rule 1: returns the NUMBER of cycles, not the cycles, leaving
// `Cycles` free for the cycle decomposition Wolfram's own `Cycles` holds); `TwoCycleCount`,
// `ThreeCycleCount`, `OccurrencesOf213`, `StandardTableauCount` and `TouchPointCount` all say
// their old `NumberOf…`/`NumberOfOccurrencesOf…` spelling (rule 2).

import { RENAMED_DATA } from "./naming-data.ts";

/** The head a catalog name is declared under. Identity for all but the renamed few. */
export const blessedName = (catalogName: string): string => RENAMED_DATA[catalogName] ?? catalogName;
