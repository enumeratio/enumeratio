// numerals' own carriers (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step
// 4): moved from combinatorics' domains/LEFTOVER_DOMAINS.

import type { Carrier } from "@enumeratio/structures";

export const NUMERALS_CARRIERS: readonly Carrier[] = [
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
