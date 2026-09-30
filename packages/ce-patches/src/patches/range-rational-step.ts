import { isNumber } from "@cortex-js/compute-engine";
import type { Patch } from "../patch.ts";
import { evaluateRangeWithRationalStep } from "../compute-engine/library/collections.ts";

// See collections.ts: Range's iterator/at handlers compute `lower + step*(index-1)` in
// floating point, so an exact rational step materializes as a double -- Range(0, 3, 1/3)
// holds 0.3333333333333333, not the exact thirds.
export const rangeRationalStep: Patch = {
  id: "range-rational-step",
  lands: "Range of an exact rational step materializes exact rationals",
  files: ["src/compute-engine/library/collections.ts"],
  heads: ["Range"],

  fixed: (ce) => {
    const r = ce.box(["Range", 0, 3, ["Rational", 1, 3]] as never);
    const second = r.at(2);
    return (
      second !== undefined &&
      isNumber(second) &&
      second.isExact === true &&
      second.isEqual(ce.box(["Rational", 1, 3] as never)) === true
    );
  },

  apply: (ce) => evaluateRangeWithRationalStep(ce),
};

export { evaluateRangeWithRationalStep } from "../compute-engine/library/collections.ts";
