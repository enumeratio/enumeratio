// Permutation-statistic signatures that do NOT reduce to an expression, with the reason.
// Being here is a claim to be justified, not a place to put anything inconvenient — and the
// list is checked: every head the catalog knows for this carrier must either have a
// definition or sit here.
//
// (Moved from @enumeratio/statistics' combined frontier.ts, split per area, step 6b.)

import type { FrontierEntry } from "../../src/statistics/types.ts";

// Empty, as of the set-partition statistics. It was not empty for long stretches, and it
// was wrong every time it had something on it — always in the same direction. It said
// compute-engine had no fold form (it has `Fold`); then that a fold could only carry a
// fixed-width accumulator (it can grow); then that Denert needed a growing table (it needed
// the same filtered double-sum `Inversions` uses); then that bounce, dinv, crossings and
// nestings were "kernel" work (bounce and dinv fold over step positions; the set-partition
// pair needed an arc representation, which is a map, not a kernel). Nine statistics moved
// off this list once each claim was checked rather than asserted. Anything that lands here
// next should be treated as unproven, not impossible.
export const PERMUTATIONS_FRONTIER: readonly FrontierEntry[] = [];
