// Carrier data for the graphs area (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 4). Hand-maintained: split from the retired domains/scripts/extract.ts
// generator, one-time, from the last generated domain-data.ts. Families for this area move
// here in step 5.
//
// `carrierParams: 1` matches the `n` these two carriers' own families (families/core.ts:
// Tournaments, LabeledGraphs, LabeledGraphsByEdges) pack as their carrierParams -- the shape's
// leading `integer` slot, ahead of the edge list -- so the oracle's packed-tuple unwrap
// (emit.ts/structural.ts) reads it from here rather than guessing (TQ-5).

import type { Carrier } from "@enumeratio/structures";

export const GRAPHS_CARRIERS: readonly Carrier[] = [
  {
    name: "LabeledGraph",
    type: "labeled_graph",
    shape: "tuple<integer, list<integer>>",
    id: "labeled_graph",
    plural: "LabeledGraphs",
    carrierParams: 1,
  },
  {
    name: "Tournament",
    type: "tournament",
    shape: "tuple<integer, list<integer>>",
    id: "tournament",
    plural: "Tournaments",
    carrierParams: 1,
  },
];
