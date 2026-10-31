// Statistics that no area's statistic list holds, declared once every area has declared its
// carriers and the heads these extend (`Descents`, `Height`, `Leaves`, ...).

import { recurse as recurseOver, self as callSelf } from "../recursion.ts";
import type { Definition, MathJSON } from "./types.ts";
import {
  add,
  adjacent,
  and,
  at,
  atLeastValue,
  bind,
  count,
  equals,
  fallsAfter,
  forEach,
  greater,
  hasPair,
  here,
  length,
  less,
  nonEmpty,
  positions,
  subtract,
  upTo,
  where,
  x,
} from "./vocabulary.ts";

const recurse = recurseOver as (body: MathJSON, params: readonly string[], ...args: readonly MathJSON[]) => MathJSON;
const self = callSelf as (...args: readonly MathJSON[]) => MathJSON;

// ── standard tableaux: `_x` is the rows ──────────────────────────────────────────────────

/** The row (1-based) holding the entry `v`. */
const rowOf = (v: MathJSON): MathJSON => [
  "Sum",
  forEach(positions, ["Multiply", "i", count(at("i"), equals("w", v), "w")], "i"),
];
/** The number of entries of the tableau. */
const entries: MathJSON = ["Sum", forEach(positions, length(at("i")), "i")];
/** The entries `j` whose successor `j + 1` sits in a lower row. */
const descentEntries: MathJSON = where(upTo(subtract(entries, 1)), greater(rowOf(add("j", 1)), rowOf("j")), "j");
const hasSuccessor = (body: MathJSON): MathJSON => ["If", less(entries, 2), 0, body];

// ── Motzkin and Schroeder paths ──────────────────────────────────────────────────────────

/** The height after the first `i` steps of a Motzkin path, whose steps 1, 0, -1 are the rises. */
const motzkinHeightAfter = (i: MathJSON): MathJSON => ["Sum", forEach(upTo(i), at("k"), "k")];
/** The height after the first `i` steps of a Schroeder path: the double level step 2 does not rise. */
const schroederHeightAfter = (i: MathJSON): MathJSON => [
  "Sum",
  forEach(upTo(i), ["If", equals(at("k"), 2), 0, at("k")], "k"),
];
const heightOfPath = (heightAfter: (i: MathJSON) => MathJSON): MathJSON =>
  nonEmpty(["Max", forEach(positions, heightAfter("i"))]);
/** An up step (1) at `i` followed at once by a down step (-1). */
const peakAt: MathJSON = and(equals(at("i"), 1), equals(at(add("i", 1)), -1));
const stepsWithSuccessor: MathJSON = upTo(subtract(length(), 1));

// ── trees ────────────────────────────────────────────────────────────────────────────────

/** The vertices of an ordered tree (`_x`, the list of its children's trees) with exactly one child. */
const unaryVertices: MathJSON = recurse(
  [
    "If",
    equals(length("t"), 0),
    0,
    add(["If", equals(length("t"), 1), 1, 0], ["Sum", ["Map", ["Function", self("c"), "c"], "t"]]),
  ],
  ["t"],
  x,
);

/** The row `i` of a plane partition, `_x` being its rows. */
const row: MathJSON = at("i");

export const CARRIER_STATISTICS: readonly Definition[] = [
  {
    head: "Descents",
    on: "SignedPermutation",
    summary: "Indices 0 <= i < n with s(i) > s(i+1), setting s(0) = 0.",
    expr: nonEmpty(add(["If", less(at(1), 0), 1, 0], hasPair(count(adjacent, fallsAfter)))),
    note: "The type B descents: a negative first entry counts, as a drop from the fixed 0 before it (FindStat St001427).",
  },
  {
    head: "Descents",
    on: "StandardTableau",
    summary: "Entries i whose successor i + 1 is in a strictly lower row.",
    expr: hasSuccessor(count(upTo(subtract(entries, 1)), greater(rowOf(add("j", 1)), rowOf("j")), "j")),
  },
  {
    head: "MajorIndex",
    on: "StandardTableau",
    summary: "The sum of the descents of the tableau.",
    expr: hasSuccessor(["Sum", descentEntries]),
  },
  {
    head: "LargestPart",
    on: "PlanePartition",
    summary: "The largest entry: the corner of the array.",
    expr: nonEmpty(["Max", ["Flatten", x]]),
  },
  {
    head: "Trace",
    on: "PlanePartition",
    summary: "The sum of the diagonal entries.",
    expr: nonEmpty(["Sum", forEach(where(positions, atLeastValue(length(row), "i")), at("i", row))]),
  },
  {
    head: "Descents",
    on: "Composition",
    summary: "Positions i with c(i) > c(i+1).",
    expr: hasPair(count(adjacent, fallsAfter)),
  },
  {
    head: "PartsEqualOne",
    on: "Composition",
    summary: "Parts equal to 1.",
    expr: nonEmpty(count(positions, equals(here, 1))),
  },
  {
    head: "Height",
    on: "MotzkinPath",
    summary: "The greatest height the path reaches.",
    expr: heightOfPath(motzkinHeightAfter),
  },
  {
    head: "Peaks",
    on: "MotzkinPath",
    summary: "Occurrences of an up step immediately followed by a down step.",
    expr: hasPair(count(stepsWithSuccessor, peakAt)),
  },
  {
    head: "Height",
    on: "SchroederPath",
    summary: "The greatest height the path reaches.",
    expr: heightOfPath(schroederHeightAfter),
  },
  {
    head: "Peaks",
    on: "SchroederPath",
    summary: "Occurrences of an up step immediately followed by a down step.",
    expr: hasPair(count(stepsWithSuccessor, peakAt)),
  },
  {
    head: "Hills",
    on: "SchroederPath",
    summary: "Peaks at height 1 — an up step from the axis immediately followed by a down step.",
    expr: hasPair(count(stepsWithSuccessor, and(peakAt, equals(schroederHeightAfter("i"), 1)))),
  },
  {
    head: "UnaryNodes",
    on: "OrderedTree",
    summary: "The number of vertices with exactly one child.",
    expr: unaryVertices,
  },
  {
    head: "Leaves",
    on: "LabeledTree",
    summary: "The number of vertices on exactly one edge.",
    expr: bind(
      "ends",
      ["Flatten", x],
      count(["Unique", "ends"], equals(count("ends", equals("w", "v"), "w"), 1), "v"),
      "list<integer>",
    ),
    note: "`_x` is the edge set, so a tree on one vertex, with no edges, has none.",
  },
];
