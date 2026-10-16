// RestrictedGrowthStrings split out of collections/src/families/paths-partitions.ts (which mixed
// lattice-paths and set-partitions families) per
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 5 -- the only family in its section carrying a carrier ("RestrictedGrowthString").
// NonCrossingPartitions/NonNestingPartitions/NonCrossingMatchings/NonNestingMatchings declare no
// carrier at all and stay in collections per step 5 rule 4.
//
// ─── RestrictedGrowthStrings(n): length-n words w with w[0]=0 and w[i] <= 1+max(w[0..i-1]) — the
// canonical RGS encoding of a set partition of [n] (w[i] = block index of element i+1, in
// first-appearance order). Count = BellB(n); SetPartitions ranks through this exact word and just
// reshapes it into blocks, so both share one definition (./core.ts) — here the word itself IS the
// element. It is defined in Epsil; the TS reading (RgsUnrank/RgsRank in
// collections/src/families/kernels-combinatorics.ts, and the check below) is the independent
// reading tests/readings/ holds it to; the count stays exact past 2^53 (`fastCount`). ─────────
import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import { bellExact } from "../../../collections/src/families/exact-recurrences.ts";
import { restrictedGrowthStrings } from "./core.ts";
export const entries: EpsilFamily[] = [{ ...restrictedGrowthStrings, fastCount: ([n]) => bellExact(n) }];
