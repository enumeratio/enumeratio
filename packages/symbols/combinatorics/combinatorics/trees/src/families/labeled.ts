// LabeledTrees split out of collections/src/families/core.ts (which mixed every area) per
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 5 -- wire-carriers lane A-92: it now
// carries "LabeledTree", the edge set (its element already is one, kind "blocks"). Kept apart
// from core.ts's nested-tree families (BinaryTrees/FullKAryTrees/OrderedTrees): a different kind
// ("blocks" vs "nested"), no reason to share a file. RootedForests -- the family LabeledTrees sat
// beside in collections -- still declares no carrier, so it stays there.
//
// Defined in Epsil: the tree of Prüfer sequence `_r` (see ./peel.ts), its edges in the order the
// leaves are removed, then the last edge. `labeledTreesKernel`, the TS kernel it replaced, is the
// independent reading its agreement test checks it against.
import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import {
  LabeledTreeCount,
  LabeledTreeUnrank,
  LabeledTreeRank,
  IsLabeledTreeOf,
} from "../../../collections/src/families/kernels-extra.ts";
import {
  add,
  and,
  at,
  equal,
  fold,
  iff,
  less,
  lets,
  map,
  mul,
  sub,
  upTo,
} from "../../../collections/src/families/tables.ts";
import type { NumberKernel } from "../../../collections/src/families/types.ts";
import { degreesOfSequence, pruferDigits, removeLeaf, smallestLeaf, zeros } from "./peel.ts";

type MathJSON = unknown;

export const labeledTreesKernel: NumberKernel = {
  head: "LabeledTrees",
  paramCount: 1,
  kind: "blocks",
  carrier: "LabeledTree",
  count: ([n]) => LabeledTreeCount(n),
  unrank: ([n], r) => LabeledTreeUnrank(n, r),
  valid: (e, [n]) => IsLabeledTreeOf(e as number[][], n),
  rank: (e, [n]) => LabeledTreeRank(e as number[][], n),
};

const N = "_n";
const edges = "_x";
const end = (edge: MathJSON, side: 1 | 2): MathJSON => at(edge, side);

/** Edge j is the leaf removed at step j with the sequence's entry j; the last is the vertex left
 *  with n. The peeled state is the degrees, then each step's leaf. */
const unrank: MathJSON = lets(
  [["sq", pruferDigits(N), "list<integer>"]],
  lets(
    [
      [
        "peeled",
        fold(
          lets(
            [
              ["ul", smallestLeaf("us", N, "u"), "integer"],
              ["ux", at("sq", "ui"), "integer"],
            ],
            ["ReplaceAt", removeLeaf("us", "ul", "ux"), add(N, "ui"), "ul"],
          ),
          "us",
          "ui",
          ["Join", degreesOfSequence("sq", N), zeros(sub(N, 2))],
          upTo(1, sub(N, 2)),
        ),
        "list<integer>",
      ],
    ],
    map(
      iff(
        equal("uj", sub(N, 1)),
        ["List", smallestLeaf("peeled", N, "z"), N],
        lets(
          [
            ["el", at("peeled", add(N, "uj")), "integer"],
            ["ex", at("sq", "uj"), "integer"],
          ],
          ["List", ["Min", "el", "ex"], ["Max", "el", "ex"]],
        ),
      ),
      "uj",
      upTo(1, sub(N, 1)),
    ),
  ),
);

/** The degrees of the edge list: how many edges end at each vertex. */
const degrees: MathJSON = map(
  fold(add("dg", ["If", ["Or", equal(end("de", 1), "dv"), equal(end("de", 2), "dv")], 1, 0]), "dg", "de", 0, edges),
  "dv",
  upTo(1, N),
);

/** The neighbour of `leaf` that isn't removed yet (degree above 0 in `state`), 0 if none. */
const neighbour = (state: MathJSON, leaf: MathJSON): MathJSON =>
  fold(
    iff(
      and(equal(end("ne", 1), leaf), less(0, at(state, end("ne", 2)))),
      end("ne", 2),
      iff(and(equal(end("ne", 2), leaf), less(0, at(state, end("ne", 1)))), end("ne", 1), "nf"),
    ),
    "nf",
    "ne",
    0,
    edges,
  );

/** Rank: peel the edges, the state the degrees, then the rank so far (base n, entries less 1). */
const rank: MathJSON = at(
  fold(
    lets(
      [["rl", smallestLeaf("rs", N, "r"), "integer"]],
      lets(
        [["rn", neighbour("rs", "rl"), "integer"]],
        ["ReplaceAt", removeLeaf("rs", "rl", "rn"), add(N, 1), add(mul(at("rs", add(N, 1)), N), sub("rn", 1))],
      ),
    ),
    "rs",
    "ri",
    ["Join", degrees, ["List", 0]],
    upTo(1, sub(N, 2)),
  ),
  add(N, 1),
);

/** Whether the edges peel away completely, n − 1 steps each finding a leaf, which only a tree
 *  does. The state is the degrees, then 1 while every step has found its leaf. */
const peelsAway: MathJSON = at(
  fold(
    lets(
      [["vl", smallestLeaf("vs", N, "v"), "integer"]],
      iff(
        equal("vl", 0),
        ["ReplaceAt", "vs", add(N, 1), 0],
        lets([["vn", neighbour("vs", "vl"), "integer"]], removeLeaf("vs", "vl", "vn")),
      ),
    ),
    "vs",
    "vi",
    ["Join", degrees, ["List", 1]],
    upTo(1, sub(N, 1)),
  ),
  add(N, 1),
);

const wellFormedEdge = (edge: MathJSON): MathJSON =>
  iff(
    equal(["Length", edge], 2),
    and(
      ["LessEqual", 1, end(edge, 1)],
      ["LessEqual", end(edge, 1), N],
      ["LessEqual", 1, end(edge, 2)],
      ["LessEqual", end(edge, 2), N],
      ["NotEqual", end(edge, 1), end(edge, 2)],
    ),
    "False",
  );

const labeledTrees: EpsilFamily = {
  head: "LabeledTrees",
  paramCount: 1,
  kind: "blocks",
  carrier: "LabeledTree",
  params: ["_n"],
  elementType: "list<tuple<integer, integer>>",
  fast: labeledTreesKernel,
  epsil: {
    count: iff(["LessEqual", N, 0], 0, iff(["LessEqual", N, 2], 1, ["Power", N, sub(N, 2)])),
    unrank,
    rank,
    valid: iff(
      equal(["Length", edges], sub(N, 1)),
      iff(fold(and("ok", wellFormedEdge("ve")), "ok", "ve", "True", edges), equal(peelsAway, 1), "False"),
      "False",
    ),
  },
};

export const entries: EpsilFamily[] = [labeledTrees];
