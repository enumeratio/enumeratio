// Lattice-path variants: Epsil definitions over the walks of ../../../lattice-paths. Their TS
// kernels (plain JS numbers/arrays) are the independent readings tests/readings/ holds them to;
// Riordan and Fine keep an exact count past 2^53 (`fastCount`).
//
// RestrictedGrowthStrings and NonCrossingPartitions/NonNestingPartitions/NonCrossingMatchings/
// NonNestingMatchings moved to set-partitions/src/families/{paths-partitions,matchings}.ts --
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 5. The latter four now carry
// "SetPartition" (their "blocks" shape matches it exactly). DelannoyPaths/LukasiewiczPaths/
// MotzkinPathsByPeaks moved to lattice-paths/src/families/paths-partitions.ts (wire-carriers
// lane A-90): they now carry "DelannoyPath"/"LukasiewiczPath"/"MotzkinPath".
// GrandDyckPaths/RiordanPaths/FinePaths/BallotSequences declare no carrier and stay here per
// step 5 rule 4.
import type { NumberKernel } from "./types.ts";
import type { EpsilFamily } from "./epsil.ts";
import { latticePaths } from "./closed-forms.ts";
import { fineExact, riordanExact } from "./exact-recurrences.ts";
import { quotient } from "./tables.ts";
import { dyckPaths } from "../../../lattice-paths/src/families/core.ts";
import { finePaths } from "../../../lattice-paths/src/families/fine-paths.ts";
import { completionsOf, completionsTable, type Step, walkFamily } from "../../../lattice-paths/src/families/walks.ts";
// ─── GrandDyckPaths(n): free ±1-step paths of length 2n over up(1)/down(0), starting and ending at
// height 0, with NO non-negativity constraint. Count = C(2n,n): choose which n of the 2n
// positions are up-steps — a direct wrapper over KSubset{Count,Unrank,Rank} from kernels-extra.ts.
// Steps encoded 1=up/0=down, matching the DyckPaths convention (just without the height floor). ──
// ─── RiordanPaths(n): Motzkin paths of length n (steps U=+1,L=0,D=-1) with no LEVEL step taken at
// height 0 — the Riordan numbers (1,0,1,1,3,6,15,36,...; A005043). completions(s,h) = ways to
// finish s steps from height h ending at 0, identical to the Motzkin recursion but with the level
// term dropped when h===0. ────────────────────────────────────────────────────────────────────
// ─── FinePaths(n): Dyck paths of semilength n with no "hills" — an elementary U D arch touching
// the ground on both sides. Every Dyck path decomposes uniquely into a sequence of PRIMITIVE
// blocks at ground level (each U <inner Dyck path> D, touching height 0 only at its own ends); a
// hill is a primitive block whose inner path is empty (block semilength 1). Fine(n) counts
// sequences of primitive blocks, every one of semilength >= 2, summing to n — the Fine numbers
// (1,0,1,1,3,8,21,...; A000957). A block of semilength m contributes CatalanNumber(m-1) choices of
// inner path; unrank/rank walk the blocks left to right, recursing into the (shorter) remainder
// exactly like a composition-into-parts enumeration. ────────────────────────────────────────────
// GrandDyckPaths is LatticePaths(n, n) under another name: the words with n ups among 2n steps,
// in the colex order of the ups' positions that its TS kernel (KSubset) reads.
const grandDyckPaths = latticePaths({
  head: "GrandDyckPaths",
  carrier: "DyckPath",
  params: ["_n"],
  ones: "_n",
  zeros: "_n",
});
// Up (1), level (0, never at height 0), down (-1), length n: the Riordan numbers.
const riordanSteps: readonly Step[] = [
  { token: 1, rise: 1, width: 1 },
  { token: 0, rise: 0, width: 1, aboveGround: true },
  { token: -1, rise: -1, width: 1 },
];
const riordanPaths = walkFamily({
  head: "RiordanPaths",
  carrier: "MotzkinPath",
  fastCount: ([n]) => riordanExact(n),
  params: ["_n"],
  width: "_n",
  steps: riordanSteps,
  tables: [completionsTable("t", riordanSteps, "_n", quotient("_n", 2))],
  completions: completionsOf(quotient("_n", 2)),
});

// BallotSequences is DyckPaths under another name, its TS kernel the same DyckPath one.
const ballotSequences: EpsilFamily = { ...dyckPaths, head: "BallotSequences" };

// Kept separate from `entriesAfterDyckPathsByHeight` below only so
// collections/src/families/index.ts can splice `latticePathsPathsPartitionsEntries`
// (DyckPathsByHeight) back in at the exact interior position it held before the lattice-paths
// move — §4 step 5. NonCrossingPartitions/NonNestingPartitions/NonCrossingMatchings/
// NonNestingMatchings moved to set-partitions/src/families/matchings.ts, spliced back in here
// by collections/src/families/index.ts — they now carry "SetPartition".
export const entriesBeforeDyckPathsByHeight: (NumberKernel | EpsilFamily)[] = [
  grandDyckPaths,
  riordanPaths,
  { ...finePaths, fastCount: ([n]) => fineExact(n) },
  ballotSequences,
];
