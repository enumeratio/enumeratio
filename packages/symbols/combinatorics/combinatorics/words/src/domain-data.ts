// Carrier domains for the words area (design/speculative/combinatorics-layering-and-
// plausible.md §4 step 4). Hand-maintained: split from the retired domains/scripts/extract.ts
// generator, one-time, from the last generated domain-data.ts. Families for this area move
// here in step 5.

import type { Domain } from "@enumeratio/structures";

export const WORDS_DOMAINS: readonly Domain[] = [
  {
    name: "AscentSequence",
    type: "ascent_sequence",
    shape: "list<integer>",
    id: "ascent_sequence",
    plural: "AscentSequences",
  },
  {
    name: "BinaryWord",
    type: "binary_word",
    shape: "list<integer>",
    id: "binary_word",
    plural: "BinaryWords",
  },
  {
    name: "Endofunction",
    type: "endofunction",
    shape: "list<integer>",
    id: "endofunction",
    plural: "Endofunctions",
  },
  {
    name: "HyperbinaryWord",
    type: "hyperbinary_word",
    shape: "list<integer>",
    id: "hyperbinary_word",
    plural: "HyperbinaryWords",
  },
  {
    name: "HypernumeraryWord",
    type: "hypernumerary_word",
    shape: "list<integer>",
    id: "hypernumerary_word",
    plural: "HypernumeraryWords",
  },
  {
    name: "ParkingFunction",
    type: "parking_function",
    shape: "list<integer>",
    id: "parking_function",
    plural: "ParkingFunctions",
  },
  {
    name: "TernaryGrayCode",
    type: "ternary_gray_code",
    shape: "list<integer>",
    id: "ternary_gray_code",
    plural: "TernaryGrayCodes",
  },
  {
    name: "Word",
    type: "word",
    shape: "list<integer>",
    id: "word",
    plural: "Words",
  },
];
