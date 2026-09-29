// residues' own carrier (design/speculative/combinatorics-layering-and-plausible.md §4 step
// 4): moved from combinatorics' domains/LEFTOVER_DOMAINS.

import type { CarrierDeclaration } from "@enumeratio/structures";

export const RESIDUES_CARRIERS: readonly CarrierDeclaration[] = [
  {
    name: "ModularResidue",
    type: "modular_residue",
    shape: "tuple<integer, integer>",
    id: "modular_residue",
    plural: "ModularResidues",
  },
];
