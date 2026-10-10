// Tableaux' own declare (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 5, A-94).
import type { Engine } from "@enumeratio/engine";
import { declareCarriers } from "@enumeratio/structures";
import { declareFamilies } from "../../collections/src/families/declare.ts";
import { liftFamily } from "../../collections/src/families/epsil.ts";
import { TABLEAUX_CARRIERS } from "./carrier-data.ts";
import {
  standardTableauPairsEntries,
  standardTableauxEntries,
  tableauxPlaneBeforeSkewStandardTableauxEntries,
  tableauxPlanePlanePartitionsEntries,
  tableauxPlaneShiftedStandardTableauxEntries,
  tableauxPlaneSkewStandardTableauxEntries,
} from "./families/index.ts";

export function declareTableaux(ce: Engine): void {
  declareCarriers(ce, TABLEAUX_CARRIERS, { plurals: false });
  declareFamilies(
    ce,
    [
      ...tableauxPlaneBeforeSkewStandardTableauxEntries,
      ...tableauxPlaneSkewStandardTableauxEntries,
      ...standardTableauxEntries,
      ...tableauxPlaneShiftedStandardTableauxEntries,
      ...standardTableauPairsEntries,
      ...tableauxPlanePlanePartitionsEntries,
    ].map(liftFamily),
  );
}
