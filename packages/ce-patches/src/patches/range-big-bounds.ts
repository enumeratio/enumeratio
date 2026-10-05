import { operandsOf } from "@enumeratio/engine";
import type { Patch } from "../patch.ts";
import { evaluateRangeBigBounds } from "../compute-engine/library/range.ts";

// See range.ts: `Range`'s `count`/`iterator`/`at` run in doubles, so integer bounds past 2^53
// round together and `Range(2^225, 2^225 + 5)` materialises as one float instead of six exact
// integers, as Wolfram's `Range` gives.
export const rangeBigBounds: Patch = {
  id: "range-big-bounds",
  lands: "Range counts and steps in exact integers when a bound is past 2^53, as Wolfram's Range does",
  files: ["src/compute-engine/library/range.ts"],
  heads: ["Range"],

  fixed: (ce) =>
    operandsOf(ce.box(["Range", ["Power", 2, 225], ["Add", 5, ["Power", 2, 225]]]).evaluate({ materialization: true }))
      .length === 6,

  apply: (ce) => evaluateRangeBigBounds(ce),
};

export { evaluateRangeBigBounds } from "../compute-engine/library/range.ts";
