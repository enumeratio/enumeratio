// FindStat's own declare (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 5, A-94):
// carriers only -- FindStat contributes no family of its own, just DistributionMatchHit and
// FindStatHit's carriers, for the tooling that reads a FindStat hit.
import type { Engine } from "@enumeratio/engine";
import { declareCarriers } from "@enumeratio/structures";
import { FINDSTAT_CARRIERS } from "./carrier-data.ts";

export function declareFindStat(ce: Engine): void {
  declareCarriers(ce, FINDSTAT_CARRIERS, { plurals: false });
}
