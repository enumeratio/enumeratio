// Combinatorial maps whose `from` carrier is `set_partition`, `restricted_growth_string`,
// `set_composition` or `surjection` — all set-partitions-owned carriers (step 6c).

import {
  at,
  bind,
  blocksOf,
  forEach,
  type CombinatorialMap,
  type MathJSON,
  positions,
  size,
} from "../../src/map-helpers.ts";

/** A set partition's restricted growth string, labels from `base`: position i carries the index
 *  of its block, blocks in the order they are kept. */
const growthStringOf = (blocks: MathJSON, base = 0): MathJSON => [
  "Map",
  ["Function", ["Add", base - 1, ["IndexWhere", blocks, ["Function", ["Element", "i", "b"], "b"]]], "i"],
  ["Range", 1, ["Length", ["Flatten", blocks]], 1],
];

/** The smallest later position sharing i's label in the restricted growth string, or i
 *  itself when none does — i.e. i's successor within its own block. */
const nextInBlock = (i: MathJSON): MathJSON => {
  const later: MathJSON = ["Filter", ["Range", ["Add", i, 1], size, 1], ["Function", ["Equal", at("k"), at(i)], "k"]];
  return ["If", ["Greater", ["Length", later], 0], ["Min", later], i];
};

/** `expr` with every `from` symbol renamed `to`. */
const rename = (expr: MathJSON, from: string, to: string): MathJSON =>
  expr === from ? to : Array.isArray(expr) ? (expr as readonly MathJSON[]).map((x) => rename(x, from, to)) : expr;

export const SET_PARTITIONS_MAPS: readonly CombinatorialMap[] = [
  {
    name: "RestrictedGrowthString",
    convert: true,
    from: "set_partition",
    to: "restricted_growth_string",
    body: growthStringOf("_raw"),
    summary: "A set partition's restricted growth string: each position labelled with its block's index, from 0.",
    note: "An order isomorphism: the k-th set partition of n, in the order SetPartitions lists them, goes to the k-th restricted growth string of length n. So everything defined on one carrier is available on the other through it.",
    laws: [{ inverse: "SetPartition" }],
    orderIsomorphism: { from: "SetPartitions", to: "RestrictedGrowthStrings" },
  },
  {
    name: "SetPartition",
    convert: true,
    from: "restricted_growth_string",
    to: "set_partition",
    body: blocksOf("_raw", 0),
    summary: "The set partition a restricted growth string labels: block j holds the positions labelled j.",
    note: "The inverse of RestrictedGrowthString(partition), and order-preserving in the same way.",
    laws: [{ inverse: "RestrictedGrowthString" }],
    orderIsomorphism: { from: "RestrictedGrowthStrings", to: "SetPartitions" },
  },
  {
    name: "Surjection",
    convert: true,
    from: "set_composition",
    to: "surjection",
    body: growthStringOf("_raw", 1),
    summary: "A set composition as a surjection: each position labelled with its block's index, from 1.",
    laws: [{ inverse: "SetComposition" }],
  },
  {
    name: "SetComposition",
    convert: true,
    from: "surjection",
    to: "set_composition",
    body: blocksOf("_raw", 1),
    summary: "The set composition a surjection labels: block j holds the positions labelled j.",
    laws: [{ inverse: "Surjection" }],
  },
  {
    name: "ArcRepresentation",
    from: "set_partition",
    to: "endofunction",
    // Read through the restricted growth string: position i's block label. A block's members
    // are in ascending order by position, so "the next element in i's block" is just the
    // smallest later position sharing i's label — a function on 1..n, which is exactly what
    // an endofunction IS. The arcs of the standard representation are the pairs (i, f(i)) with
    // f(i) != i; a position last in its block is a fixed point.
    body: bind("aw", growthStringOf("_raw"), rename(forEach(positions, nextInBlock("i")), "_raw", "aw")),
    summary: "Each position linked to the next in its block, or to itself when last.",
    note: "The statistics frontier calls this the arc representation: within each block, consecutive elements (b1,b2), (b2,b3), .... Encoding it as an endofunction rather than a bare list of pairs keeps it a typed carrier — Crossings, Nestings and CrossingNestingTotal (@enumeratio/statistics) read the arcs off this without needing a carrier of their own.",
  },
];
