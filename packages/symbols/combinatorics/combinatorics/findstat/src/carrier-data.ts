// Carrier data for combinatorics' FindStat tooling (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 3): records the FindStat oracle scripts use, not
// mathematical carriers of an area's own. Split from domains/src/domain-data.ts's
// LEFTOVER_DOMAINS, which is where every carrier without an area used to sit regardless of
// what it actually was.

import type { Carrier } from "@enumeratio/structures";

export const FINDSTAT_CARRIERS: readonly Carrier[] = [
  {
    name: "DistributionMatchHit",
    type: "distribution_match_hit",
    shape: "tuple<string, string, list<string>, number, number>",
    id: "distribution_match_hit",
    plural: "DistributionMatchHits",
  },
  {
    name: "FindStatHit",
    type: "find_stat_hit",
    shape: "tuple<string, string, list<string>, number, number>",
    id: "find_stat_hit",
    plural: "FindStatHits",
  },
];
