import { operandsOf } from "@enumeratio/engine";
import type { Patch } from "../patch.ts";
import { evaluateRangeBigBounds } from "../compute-engine/library/range.ts";

// See range.ts: `Range`'s `iterator`/`at` run in doubles, so integer bounds past 2^53 round
// together and `Range(2^225, 2^225 + 5)` materialises as six copies of one float instead of
// six exact integers, as Wolfram's `Range` gives.
export const rangeBigBounds: Patch = {
  id: "range-big-bounds",
  lands: "Range steps in exact integers when a bound is past 2^53, as Wolfram's Range does",
  files: ["src/compute-engine/library/range.ts"],
  heads: ["Range"],

  // Six distinct elements: a count of 6 alone passes with the elements all rounded together.
  fixed: (ce) => {
    const elements = operandsOf(
      ce.box(["Range", ["Power", 2, 225], ["Add", 5, ["Power", 2, 225]]]).evaluate({ materialization: true }),
    );
    return new Set(elements.map((e) => JSON.stringify(e.json))).size === 6;
  },

  apply: (ce) => evaluateRangeBigBounds(ce),
};

export { evaluateRangeBigBounds } from "../compute-engine/library/range.ts";
