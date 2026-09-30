// Compositions' own declare (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 5, A-94).
import type { ComputeEngine } from "@cortex-js/compute-engine";
import { declareCarriers } from "@enumeratio/structures";
import { declareFamilies } from "../../collections/src/families/declare.ts";
import { numberKernel } from "../../collections/src/families/types.ts";
import { COMPOSITIONS_CARRIERS } from "./carrier-data.ts";
import { compositionsEntries, coreEntries } from "./families/index.ts";

export function declareCompositions(ce: ComputeEngine): void {
  declareCarriers(ce, COMPOSITIONS_CARRIERS, { plurals: false });
  declareFamilies(ce, [...coreEntries, ...compositionsEntries].map(numberKernel));
}
