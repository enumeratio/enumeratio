// Compositions' own declare (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 5, A-94).
import type { Engine } from "@enumeratio/engine";
import { declareCarriers } from "@enumeratio/structures";
import { declareFamilies } from "../../collections/src/families/declare.ts";
import { liftFamily } from "../../collections/src/families/epsil.ts";
import { declareStatistics } from "../../src/statistics/declare.ts";
import { COMPOSITIONS_CARRIERS } from "./carrier-data.ts";
import { compositionsEntries, coreFamilies } from "./families/index.ts";
import { COMPOSITION_STATISTICS } from "./statistics.ts";

export function declareCompositions(ce: Engine): void {
  declareCarriers(ce, COMPOSITIONS_CARRIERS, { plurals: false });
  declareFamilies(ce, [...coreFamilies, ...compositionsEntries.map(liftFamily)]);
  // Its statistics, after its own carriers and families.
  declareStatistics(ce, COMPOSITION_STATISTICS);
}
