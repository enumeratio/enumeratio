import type { Patch } from "../patch.ts";
import { quotientRingOverIntegers } from "../compute-engine/library/sets.ts";

// See sets.ts: `QuotientRing(Integers, m)` is inert -- no count, no elements, no membership --
// and is typed `set<integer>`, though its elements are residue classes.
export const quotientRingCollection: Patch = {
  id: "quotient-ring-collection",
  issue: "https://github.com/cortex-js/compute-engine/issues/399",
  lands:
    "QuotientRing(Integers, m) is the finite collection of its m residue classes, typed without claiming they are integers",
  files: ["src/compute-engine/library/sets.ts"],
  heads: ["QuotientRing"],

  fixed: (ce) => {
    const ring = ce.box(["QuotientRing", "Integers", 5]);
    return ring.isCollection && ring.count === 5 && !ring.type.matches("set<integer>");
  },

  apply: (ce) => quotientRingOverIntegers(ce),
};

export {
  integerQuotientModulus,
  quotientRingOverIntegers,
  type ResidueClasses,
  setResidueClasses,
} from "../compute-engine/library/sets.ts";
