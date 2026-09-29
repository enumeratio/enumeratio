// Carrier domains for the graphs area (design/speculative/combinatorics-layering-and-
// plausible.md §4 step 4). Hand-maintained: split from the retired domains/scripts/extract.ts
// generator, one-time, from the last generated domain-data.ts. Families for this area move
// here in step 5.

import type { Domain } from "../../domains/src/types.ts";

export const GRAPHS_DOMAINS: readonly Domain[] = [
  {
    name: "LabeledGraph",
    type: "labeled_graph",
    shape: "tuple<integer, list<integer>>",
    id: "labeled_graph",
    plural: "LabeledGraphs",
  },
  {
    name: "Tournament",
    type: "tournament",
    shape: "tuple<integer, list<integer>>",
    id: "tournament",
    plural: "Tournaments",
  },
];
