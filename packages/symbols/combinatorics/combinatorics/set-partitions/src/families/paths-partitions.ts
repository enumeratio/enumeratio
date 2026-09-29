// RestrictedGrowthStrings split out of collections/src/families/paths-partitions.ts (which mixed
// lattice-paths and set-partitions families) per
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 5 -- the only family in its section carrying a carrier ("RestrictedGrowthString").
// NonCrossingPartitions/NonNestingPartitions/NonCrossingMatchings/NonNestingMatchings declare no
// carrier at all and stay in collections per step 5 rule 4.
import type { NumberKernel } from "../../../collections/src/families/types.ts";
import { BellB, RgsRank, RgsUnrank } from "../../../collections/src/families/kernels-combinatorics.ts";

// ─── RestrictedGrowthStrings(n): length-n words w with w[0]=0 and w[i] <= 1+max(w[0..i-1]) — the
// canonical RGS encoding of a set partition of [n] (w[i] = block index of element i+1, in
// first-appearance order). Count = BellB(n); SetPartitions already unranks via this exact word
// (RgsUnrank/RgsRank in kernels-combinatorics.ts) and just reshapes it into blocks — here the word
// itself IS the element. ───────────────────────────────────────────────────────────────────────
function isRestrictedGrowthStringOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e) || e.length !== n) return false;
  let mx = -1;
  for (const v of e) {
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > mx + 1) return false;
    if (v > mx) mx = v;
  }
  return true;
}

export const entries: NumberKernel[] = [
  {
    head: "RestrictedGrowthStrings",
    carrier: "RestrictedGrowthString",
    paramCount: 1,
    kind: "ints",
    count: ([n]) => BellB(n),
    unrank: ([n], r) => RgsUnrank(n, r),
    valid: (e, [n]) => isRestrictedGrowthStringOf(e, n),
    rank: (e) => RgsRank(e as number[]),
  },
];
