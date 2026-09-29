// residues' own carrier (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step
// 4): moved from combinatorics' domains/LEFTOVER_DOMAINS.

import type { Carrier } from "@enumeratio/structures";

export const RESIDUES_CARRIERS: readonly Carrier[] = [
  {
    name: "ModularResidue",
    type: "modular_residue",
    shape: "tuple<integer, integer>",
    id: "modular_residue",
    plural: "ModularResidues",
  },
];
