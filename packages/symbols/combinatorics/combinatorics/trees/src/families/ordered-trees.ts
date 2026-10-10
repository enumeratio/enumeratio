// OrderedTrees in Epsil: the plane trees with n edges as nested lists (a node the list of its
// children, a leaf the empty list), listed in the order of their Dyck paths (the depth-first
// contour, up before down). Unrank and rank are DyckPaths' around a conversion between a path and
// its tree (./nested.ts).

import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import { add, and, at, equal, lets, mul } from "../../../collections/src/families/tables.ts";
import { dyckPaths } from "../../../lattice-paths/src/families/core.ts";
import { ANY, buildFromDyck, readOrdered, rename } from "../../../collections/src/families/nested.ts";

const N = "_n";
const length = mul(2, N);
const steps = mul(2, add(N, 1));

export const orderedTrees: EpsilFamily = {
  head: "OrderedTrees",
  carrier: "OrderedTree",
  paramCount: 1,
  kind: "nested",
  params: [N],
  // The Dyck path's own walk is closed-form, but the conversions are stack walks the interpreter
  // takes seconds a call over past 2^53.
  declinePastDoubles: true,
  epsil: {
    count: dyckPaths.epsil.count,
    unrank: lets([["op", dyckPaths.epsil.unrank, "list<integer>"]], buildFromDyck("op", length)),
    rank: lets(
      [
        ["or", readOrdered("_x", N), ANY],
        // The path is what lies between the walk's first and last step.
        ["op", ["Take", ["Drop", "or", 4], length], "list<integer>"],
      ],
      rename(dyckPaths.epsil.rank, "_x", "op"),
    ),
    valid: lets(
      [["or", readOrdered("_x", N), ANY]],
      and(equal(at("or", 1), 0), equal(at("or", 2), steps), equal(at("or", 3), 0)),
    ),
  },
};
