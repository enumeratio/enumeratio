import type { Patch } from "../patch.ts";
import { quotientRingExactCount } from "../compute-engine/library/sets.ts";

// See sets.ts: native ℤ/mℤ (ResidueClass elements, #399) counts through a double, so past
// 2^53 `Count` stays unevaluated.
export const quotientRingCollection: Patch = {
  id: "quotient-ring-collection",
  issue: "https://github.com/cortex-js/compute-engine/issues/399",
  lands: "Count(QuotientRing(Integers, m)) is the exact integer m past 2^53",
  files: ["src/compute-engine/library/sets.ts"],
  heads: ["Count"],

  fixed: (ce) =>
    ce.box(["Count", ["QuotientRing", "Integers", ce.number(2n ** 61n - 1n).json]]).evaluate().operator !== "Count",

  apply: (ce) => quotientRingExactCount(ce),
};

export { integerQuotientModulus, quotientRingExactCount } from "../compute-engine/library/sets.ts";
