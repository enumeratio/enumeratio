// Endofunctions split out of collections/src/families/core.ts (which mixed every area) per
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 5 (wire-carriers lane A-91): its element (list<integer>) matches "Endofunction"'s shape
// exactly, same as BinaryWords <-> BinaryWord in words.ts. BinaryStrings/LatticePaths stay in
// collections per step 5 rule 4.
import type { NumberKernel } from "../../../collections/src/families/types.ts";
import { TupleUnrank, TupleRank, IsTupleOf } from "../../../collections/src/families/kernels-extra.ts";

export const entries: NumberKernel[] = [
  {
    head: "Endofunctions",
    carrier: "Endofunction",
    paramCount: 1,
    kind: "ints",
    count: ([n]) => n ** n,
    unrank: ([n], r) => TupleUnrank(n, n, r),
    valid: (e, [n]) => IsTupleOf(e as number[], n, n),
    rank: (e, [n]) => TupleRank(e as number[], n),
  },
];
