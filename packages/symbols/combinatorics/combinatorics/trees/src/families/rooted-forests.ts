// RootedForests split out of collections/src/families/core.ts (which mixed every area) per
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 5 -- wire-carriers lane A-92: it now
// carries the new "RootedForest" carrier, matching its element (kind "ints", a length-n parent
// array; entry 0 marks a root, same encoding LabeledTrees' Prüfer bijection already builds it
// from). Kept apart from labeled.ts: a different kind ("ints" vs "blocks"), no reason to share.
//
// Defined in Epsil: a rooted forest on n vertices is a labeled tree on n + 1 rooted at the vertex
// n + 1 (see ./peel.ts). Peeling never removes the root, so a removed leaf's neighbour is its
// parent. `rootedForestsKernel`, the TS kernel it replaced, is the independent reading its
// agreement test checks it against.
import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import {
  RootedForestCount,
  RootedForestUnrank,
  RootedForestRank,
  IsRootedForest,
} from "../../../collections/src/families/kernels-extra.ts";
import {
  add,
  all,
  and,
  at,
  equal,
  fold,
  iff,
  lets,
  map,
  mul,
  sub,
  upTo,
} from "../../../collections/src/families/tables.ts";
import type { NumberKernel } from "../../../collections/src/families/types.ts";
import { degreesOfSequence, pruferDigits, removeLeaf, smallestLeaf, zeros } from "./peel.ts";

export const rootedForestsKernel: NumberKernel = {
  head: "RootedForests",
  paramCount: 1,
  kind: "ints",
  carrier: "RootedForest",
  count: ([n]) => RootedForestCount(n),
  unrank: ([n], r) => RootedForestUnrank(n, r),
  valid: (a, [n]) => IsRootedForest(a, n),
  rank: (a, [n]) => RootedForestRank(a as number[], n),
};

type MathJSON = unknown;

const n = "_n";
const parents = "_x";
/** The tree's vertices: 1..n and the root. */
const N = add(n, 1);
/** The parent array entry for a neighbour: 0 for the root. */
const parentOf = (nb: MathJSON): MathJSON => iff(equal(nb, N), 0, nb);

/** The state is the degrees of 1..n + 1, then the parent of each of 1..n, 0 until its leaf goes. */
const unrank: MathJSON = lets(
  [["sq", pruferDigits(N), "list<integer>"]],
  [
    "Drop",
    fold(
      lets(
        [
          ["ul", smallestLeaf("us", N, "u"), "integer"],
          ["ux", at("sq", "ui"), "integer"],
        ],
        ["ReplaceAt", removeLeaf("us", "ul", "ux"), add(N, "ul"), parentOf("ux")],
      ),
      "us",
      "ui",
      ["Join", degreesOfSequence("sq", N), zeros(n)],
      upTo(1, sub(N, 2)),
    ),
    N,
  ],
);

/** Degrees: a child's edge to its parent, and an edge to each child; the root has its roots. */
const degrees: MathJSON = map(
  iff(
    equal("dv", N),
    ["Count", ["Filter", parents, ["Function", equal("dy", 0), "dy"]]],
    add(1, ["Count", ["Filter", parents, ["Function", equal("dy", "dv"), "dy"]]]),
  ),
  "dv",
  upTo(1, N),
);

/** Rank: peel, the state the degrees then the rank so far (base n + 1, entries less 1). */
const rank: MathJSON = at(
  fold(
    lets(
      [["rl", smallestLeaf("rs", N, "r"), "integer"]],
      lets(
        [["rn", iff(equal(at(parents, "rl"), 0), N, at(parents, "rl")), "integer"]],
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

/** Whether following parents from vertex i reaches a root (0) within n steps. */
const reachesRoot = (i: MathJSON): MathJSON =>
  equal(fold(iff(equal("vp", 0), 0, at(parents, "vp")), "vp", "vk", i, upTo(1, n)), 0);

const rootedForests: EpsilFamily = {
  head: "RootedForests",
  paramCount: 1,
  kind: "ints",
  carrier: "RootedForest",
  params: ["_n"],
  fast: rootedForestsKernel,
  epsil: {
    count: iff(["LessEqual", n, 0], 1, ["Power", N, sub(n, 1)]),
    unrank,
    rank,
    valid: iff(
      and(
        equal(["Length", parents], n),
        all((i) => and(["LessEqual", 0, at(parents, i)], ["LessEqual", at(parents, i), n]), upTo(1, n), "vi"),
      ),
      all(reachesRoot, upTo(1, n), "vr"),
      "False",
    ),
  },
};

export const entries: EpsilFamily[] = [rootedForests];
