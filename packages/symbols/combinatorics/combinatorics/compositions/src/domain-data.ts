// Carrier domains for the compositions area (design/speculative/combinatorics-layering-and-
// plausible.md §4 step 4). Hand-maintained: split from the retired domains/scripts/extract.ts
// generator, one-time, from the last generated domain-data.ts. Families for this area move
// here in step 5.

import type { Domain } from "../../domains/src/types.ts";

export const COMPOSITIONS_DOMAINS: readonly Domain[] = [
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
