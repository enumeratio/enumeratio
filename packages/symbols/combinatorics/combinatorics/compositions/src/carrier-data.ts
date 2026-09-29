// Carrier data for the compositions area (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 4). Hand-maintained: split from the retired domains/scripts/extract.ts
// generator, one-time, from the last generated domain-data.ts. Families for this area move
// here in step 5.

import type { Carrier } from "@enumeratio/structures";

export const COMPOSITIONS_CARRIERS: readonly Carrier[] = [
  {
    name: "Composition",
    type: "composition",
    shape: "list<integer>",
    id: "composition",
    plural: "Compositions",
  },
  {
    name: "OrderedFactorization",
    type: "ordered_factorization",
    shape: "list<integer>",
    id: "ordered_factorization",
    plural: "OrderedFactorizations",
  },
  {
    name: "WeakComposition",
    type: "weak_composition",
    shape: "list<integer>",
    id: "weak_composition",
    plural: "WeakCompositions",
  },
];
