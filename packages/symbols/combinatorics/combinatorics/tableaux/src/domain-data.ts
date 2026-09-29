// Carrier domains for the tableaux area (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 4). Hand-maintained: split from the retired domains/scripts/extract.ts
// generator, one-time, from the last generated domain-data.ts. Families for this area move
// here in step 5.

import type { Domain } from "../../domains/src/types.ts";

export const TABLEAUX_DOMAINS: readonly Domain[] = [
  {
    name: "AlternatingSignMatrix",
    type: "alternating_sign_matrix",
    shape: "list<integer>",
    id: "alternating_sign_matrix",
    plural: "AlternatingSignMatrices",
  },
  {
    name: "GelfandTsetlinPattern",
    type: "gelfand_tsetlin_pattern",
    shape: "list<integer>",
    id: "gelfand_tsetlin_pattern",
    plural: "GelfandTsetlinPatterns",
  },
  {
    name: "PlanePartition",
    type: "plane_partition",
    shape: "tuple<list<integer>, list<integer>>",
    id: "plane_partition",
    plural: "PlanePartitions",
  },
  {
    name: "SemistandardTableau",
    type: "semistandard_tableau",
    shape: "tuple<list<integer>, list<integer>>",
    id: "semistandard_tableau",
    plural: "SemistandardTableaux",
  },
  {
    name: "SkewTableau",
    type: "skew_tableau",
    shape: "tuple<list<integer>, list<integer>, list<integer>>",
    id: "skew_tableau",
    plural: "SkewTableaux",
  },
  {
    name: "StandardTableau",
    type: "standard_tableau",
    shape: "list<integer>",
    id: "standard_tableau",
    plural: "StandardTableaux",
  },
  {
    name: "StandardTableauPair",
    type: "standard_tableau_pair",
    shape: "tuple<standard_tableau, standard_tableau>",
    id: "standard_tableau_pair",
    plural: "StandardTableauPairs",
  },
];
