// Lattice paths' own declare (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 5, A-94).
import type { ComputeEngine } from "@cortex-js/compute-engine";
import { declareCarriers } from "@enumeratio/structures";
import { declareFamilies } from "../../collections/src/families/declare.ts";
import { numberKernel } from "../../collections/src/families/types.ts";
import { LATTICE_PATHS_CARRIERS } from "./carrier-data.ts";
import { coreEntries, pathsPartitionsBeforeDyckPathsByHeightEntries, pathsPartitionsEntries } from "./families/index.ts";

export function declareLatticePaths(ce: ComputeEngine): void {
  declareCarriers(ce, LATTICE_PATHS_CARRIERS, { plurals: false });
  declareFamilies(
    ce,
    [...coreEntries, ...pathsPartitionsBeforeDyckPathsByHeightEntries, ...pathsPartitionsEntries].map(numberKernel),
  );
}
