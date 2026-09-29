// hypercomplex's own carrier (design/speculative/combinatorics-layering-and-plausible.md §4
// step 4): moved from combinatorics' domains/LEFTOVER_DOMAINS.

import type { CarrierDeclaration } from "@enumeratio/structures";

export const HYPERCOMPLEX_CARRIERS: readonly CarrierDeclaration[] = [
  {
    name: "Multicomplex",
    type: "multicomplex",
    shape: "tuple<list<integer>, integer>",
    id: "multicomplex",
    plural: "Multicomplexes",
  },
];
