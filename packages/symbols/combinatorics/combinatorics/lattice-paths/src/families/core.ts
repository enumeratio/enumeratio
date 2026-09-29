// DyckPaths split out of collections/src/families/core.ts (which mixed every area) per
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 5. Judgment call: DyckPaths is the only family in core.ts's "lattice-path words"
// section carrying a top-level `carrier` ("DyckPath", a lattice-paths carrier); LatticePaths,
// MotzkinPaths, SchroederPaths and FibonacciWords declare no carrier at all and stay in
// collections per step 5 rule 4 -- so does most of paths-partitions.ts's lattice-path block for
// the same reason (see lattice-paths/src/families/paths-partitions.ts). The generic kernel math
// stays in collections/src/families/kernels*.ts.
import type { NumberKernel } from "../../../collections/src/families/types.ts";
import {
  DyckPathCount,
  DyckPathUnrank,
  DyckPathRank,
  IsDyckPath,
} from "../../../collections/src/families/kernels-extra.ts";

// helper to cut boilerplate for the flat (number[]) shape; mirrors collections/core.ts's private `ints`.
const ints = (
  head: string,
  paramCount: 1 | 2,
  count: (p: number[]) => number,
  unrank: (p: number[], r: number) => number[],
  valid: (e: number[], p: number[]) => boolean,
  rank: (e: number[], p: number[]) => number,
): NumberKernel => ({
  head,
  paramCount,
  kind: "ints",
  count,
  unrank,
  valid: (e, p) => valid(e as number[], p),
  rank: (e, p) => rank(e as number[], p),
});

export const entries: NumberKernel[] = [
  {
    ...ints(
      "DyckPaths",
      1,
      ([n]) => DyckPathCount(n),
      ([n], r) => DyckPathUnrank(n, r),
      (a, [n]) => IsDyckPath(a, n),
      (a) => DyckPathRank(a),
    ),
    carrier: "DyckPath",
  },
];
