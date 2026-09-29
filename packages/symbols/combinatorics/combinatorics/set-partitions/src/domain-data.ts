// Carrier domains for the set-partitions area (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 4). Hand-maintained: split from the retired domains/scripts/extract.ts
// generator, one-time, from the last generated domain-data.ts. Families for this area move
// here in step 5.

import type { Domain } from "../../domains/src/types.ts";

export const SET_PARTITIONS_DOMAINS: readonly Domain[] = [
  {
    name: "FiniteSetElement",
    type: "finite_set_element",
    shape: "tuple<integer, integer>",
    id: "finite_set_element",
    plural: "FiniteSetElements",
  },
  {
    name: "Finset",
    type: "finset",
    shape: "tuple<list<integer>, integer>",
    id: "finset",
    plural: "Finsets",
  },
  {
    name: "Multiset",
    type: "multiset",
    shape: "tuple<list<integer>, integer>",
    id: "multiset",
    plural: "Multisets",
  },
  {
    name: "PerfectMatching",
    type: "perfect_matching",
    shape: "list<integer>",
    id: "perfect_matching",
    plural: "PerfectMatchings",
  },
  {
    name: "RestrictedGrowthString",
    type: "restricted_growth_string",
    shape: "list<integer>",
    id: "restricted_growth_string",
    plural: "RestrictedGrowthStrings",
  },
  {
    name: "SetComposition",
    type: "set_composition",
    shape: "list<list<integer>>",
    id: "set_composition",
    plural: "SetCompositions",
  },
  {
    name: "SetPartition",
    type: "set_partition",
    shape: "list<list<integer>>",
    id: "set_partition",
    plural: "SetPartitions",
  },
  {
    name: "SignedSetComposition",
    type: "signed_set_composition",
    shape: "tuple<list<integer>, list<integer>>",
    id: "signed_set_composition",
    plural: "SignedSetCompositions",
  },
  {
    name: "SignedSubset",
    type: "signed_subset",
    shape: "tuple<list<integer>, integer>",
    id: "signed_subset",
    plural: "SignedSubsets",
  },
  {
    name: "Singleton",
    type: "singleton",
    shape: "integer",
    id: "singleton",
    plural: "Singletons",
  },
  {
    name: "Surjection",
    type: "surjection",
    shape: "list<integer>",
    id: "surjection",
    plural: "Surjections",
  },
];
