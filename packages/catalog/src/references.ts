// The catalog's crosswalk as consumers see it: the extracted rows with the corrections in
// `reference-fixes.ts` applied.

import { REFERENCES as EXTRACTED } from "./catalog-data.ts";
import { applyReferenceFixes } from "./reference-fixes.ts";

export const REFERENCES = applyReferenceFixes(EXTRACTED);
