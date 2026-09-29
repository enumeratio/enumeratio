// numerals' own carriers (design/speculative/combinatorics-layering-and-plausible.md §4 step
// 4): moved from combinatorics' domains/LEFTOVER_DOMAINS.

import type { CarrierDeclaration } from "@enumeratio/structures";

export const NUMERALS_CARRIERS: readonly CarrierDeclaration[] = [
  {
    name: "Fraction",
    type: "fraction",
    shape: "tuple<number, number>",
    id: "fraction",
    plural: "Fractions",
  },
  {
    name: "FractionalNumber",
    type: "fractional_number",
    shape: "tuple<integer, integer>",
    id: "fractional_number",
    plural: "FractionalNumbers",
  },
  {
    name: "RationalNumber",
    type: "rational_number",
    shape: "tuple<integer, integer>",
    id: "rational_number",
    plural: "RationalNumbers",
  },
];
