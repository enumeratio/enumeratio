// Restrictions of `Subsets`: by size bound, size parity and no two consecutive members. Each is
// graded by size and lex within a size, the order of the subsets it restricts; defined in Epsil
// (./closed-forms.ts).
import { subsetsOfParity, subsetsOfSizeAtMost, subsetsWithoutConsecutive } from "./closed-forms.ts";
import type { EpsilFamily } from "./epsil.ts";

export const entries: readonly EpsilFamily[] = [
  subsetsWithoutConsecutive({ head: "SubsetsWithoutConsecutive", params: ["_n"] }),
  subsetsOfSizeAtMost({ head: "SubsetsOfSizeAtMost", params: ["_n", "_k"] }),
  subsetsOfParity({ head: "EvenSubsets", params: ["_n"] }, false),
  subsetsOfParity({ head: "OddSubsets", params: ["_n"] }, true),
];
