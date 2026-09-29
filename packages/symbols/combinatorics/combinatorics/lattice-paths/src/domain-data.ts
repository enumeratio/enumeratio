// Carrier domains for the lattice-paths area (design/speculative/combinatorics-layering-and-
// plausible.md §4 step 4). Hand-maintained: split from the retired domains/scripts/extract.ts
// generator, one-time, from the last generated domain-data.ts. Families for this area move
// here in step 5.

import type { Domain } from "../../domains/src/types.ts";

export const LATTICE_PATHS_DOMAINS: readonly Domain[] = [
  {
    name: "ColoredMotzkinPath",
    type: "colored_motzkin_path",
    shape: "tuple<list<integer>, list<integer>>",
    id: "colored_motzkin_path",
    plural: "ColoredMotzkinPaths",
  },
  {
    name: "DelannoyPath",
    type: "delannoy_path",
    shape: "list<integer>",
    id: "delannoy_path",
    plural: "DelannoyPaths",
  },
  {
    name: "DyckPath",
    type: "dyck_path",
    shape: "list<integer>",
    id: "dyck_path",
    plural: "DyckPaths",
  },
  {
    name: "KDyckPath",
    type: "k_dyck_path",
    shape: "list<integer>",
    id: "k_dyck_path",
    plural: "KDyckPaths",
  },
  {
    name: "KMotzkinPath",
    type: "k_motzkin_path",
    shape: "list<integer>",
    id: "k_motzkin_path",
    plural: "KMotzkinPaths",
  },
  {
    name: "LukasiewiczPath",
    type: "lukasiewicz_path",
    shape: "list<integer>",
    id: "lukasiewicz_path",
    plural: "LukasiewiczPaths",
  },
  {
    name: "MotzkinPath",
    type: "motzkin_path",
    shape: "list<integer>",
    id: "motzkin_path",
    plural: "MotzkinPaths",
  },
  {
    name: "RationalDyckPath",
    type: "rational_dyck_path",
    shape: "list<integer>",
    id: "rational_dyck_path",
    plural: "RationalDyckPaths",
  },
  {
    name: "SchroederPath",
    type: "schroeder_path",
    shape: "list<integer>",
    id: "schroeder_path",
    plural: "SchroederPaths",
  },
];
