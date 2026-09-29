// Carrier domains for the permutations area (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 4). Hand-maintained: split from the retired domains/scripts/extract.ts
// generator, one-time, from the last generated domain-data.ts. Families for this area move
// here in step 5.

import type { Domain } from "../../domains/src/types.ts";

export const PERMUTATIONS_DOMAINS: readonly Domain[] = [
  {
    name: "AffinePermutation",
    type: "affine_permutation",
    shape: "list<integer>",
    id: "affine_permutation",
    plural: "AffinePermutations",
  },
  {
    name: "Arrangement",
    type: "arrangement",
    shape: "list<integer>",
    id: "arrangement",
    plural: "Arrangements",
  },
  {
    name: "ColoredPermutation",
    type: "colored_permutation",
    shape: "tuple<list<integer>, list<integer>>",
    id: "colored_permutation",
    plural: "ColoredPermutations",
  },
  {
    name: "CycleDecomposition",
    type: "cycle_decomposition",
    shape: "list<list<integer>>",
    id: "cycle_decomposition",
    plural: "PermutationsAsCycles",
  },
  {
    name: "DecoratedPermutation",
    type: "decorated_permutation",
    shape: "list<integer>",
    id: "decorated_permutation",
    plural: "DecoratedPermutations",
  },
  {
    name: "FactoradicNumeral",
    type: "factoradic_numeral",
    shape: "list<integer>",
    id: "factoradic_numeral",
    plural: "FactoradicNumerals",
  },
  {
    name: "Permutation",
    type: "permutation",
    shape: "list<integer>",
    id: "permutation",
    plural: "Permutations",
  },
  {
    name: "PermutationInversion",
    type: "permutation_inversion",
    shape: "list<integer>",
    id: "permutation_inversion",
    plural: "PermutationInversions",
  },
  {
    name: "RookPlacement",
    type: "rook_placement",
    shape: "list<integer>",
    id: "rook_placement",
    plural: "RookPlacements",
  },
  {
    name: "SignedPermutation",
    type: "signed_permutation",
    shape: "list<integer>",
    id: "signed_permutation",
    plural: "SignedPermutations",
  },
  {
    name: "SubexcedantSeq",
    type: "subexcedant_seq",
    shape: "list<integer>",
    id: "subexcedant_seq",
    plural: "SubexcedantSeqs",
  },
];
