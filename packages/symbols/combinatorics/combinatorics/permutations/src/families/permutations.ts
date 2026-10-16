// Permutation-carrier families beyond core.ts. Kept in its own file so parallel batches of this
// roadmap item don't collide on one file. Reuses ./kernels.ts (Factorial/PermutationUnrank/
// PermutationRank/IsPermutationOf/LehmerCode/Inversions) wherever the element representation already
// matches. EvenPermutations, LehmerCodes and SubexcedantSeqs are defined in Epsil (./closed-forms.ts):
// their kernels here are the independent readings tests/readings/ holds them to.
import { Factorial, PermutationUnrank } from "../../../collections/src/families/kernels.ts";
import { IntegerPartitionRank } from "../../../collections/src/families/kernels-combinatorics.ts";
import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import type { NumberKernel } from "../../../collections/src/families/types.ts";
import { mahonianNumber } from "../mahonian.ts";
import { arrangements, evenPermutations, lehmerCodes, subexcedantSeqs } from "./closed-forms.ts";
import { kCyclePermutations } from "./core.ts";
import { permutationsAsCycles } from "./cycles.ts";
import {
  alternatingPermutations,
  connectedPermutations,
  kDescentPermutations,
  kInversionPermutations,
  permutationsAvoiding3,
} from "./restrictions.ts";

// ─── EvenPermutations(n): the alternating group Aₙ, one-line words. ────────────────────────────────
// Lex-rank pairs (2m, 2m+1) always differ by swapping the trailing two entries (the factorial-base
// digit at that place has weight 1 and only two values), so they have opposite parity — exactly one of
// each pair is even. That makes "the r-th even permutation" just "whichever half of pair r is even".
// ─── LehmerCodes(n): the inversion tables, in their own order: read as factoradic numbers, which
// is what makes the order implied rather than chosen. They match Permutations' lex order only
// because that is the order we chose for Permutations. Element = LehmerCode(perm) ──
// (length n, the last entry always 0).
// ─── SubexcedantSeqs(n): words (a₀,…,aₙ₋₁) with 0 ≤ aᵢ ≤ i (0-indexed) — its own factorial-base ────
// odometer, a sibling of lehmer_codes with a different bound (aᵢ ≤ i here, vs the Lehmer code's aᵢ ≤ n−1−i).
// ─── KInversionPermutations(n,k): exactly k inversions — the Mahonian triangle. ────────────────────
// k = the LehmerCode digit sum; digit i (0-indexed) ranges over [0, n−1−i], so counting/ranking is a
// bounded-digit-sum mixed-radix problem — coefficients of ∏ᵢ(1+q+…+qⁱ), i.e. the q-factorial [n]_q!.
// The table the TS kernel builds is whole polynomials per size, so a large n is left to Epsil.
const kInversionPermutationsFast: EpsilFamily = {
  ...kInversionPermutations,
  // The Mahonian numbers, exact past 2^53 where the interpreter takes seconds.
  fastCount: ([n, k]) => mahonianNumber(BigInt(n), BigInt(k)),
};

// ─── PermutationsAsCycles(n): every permutation of n in cycle notation, fixed points kept. ─────
// A cycle decomposition is canonical: each cycle starts at its least point, cycles in order of
// those points. Listed by cycle type in IntegerPartitions' order (the n-cycles first, the
// identity last), then by canonical form, lexicographically. The order is our choice.
// The family itself is defined in Epsil (./cycles.ts), unranking directly; the kernel below
// enumerates all n! and sorts, and stays as the independent reading its agreement test checks
// it against.
export function CycleDecomposition(perm: readonly number[]): number[][] {
  const seen: boolean[] = Array.from({ length: perm.length + 1 }, () => false);
  const cycles: number[][] = [];
  for (let start = 1; start <= perm.length; start++) {
    if (seen[start]) continue;
    const cycle: number[] = [];
    for (let point = start; !seen[point]; point = perm[point - 1]!) {
      seen[point] = true;
      cycle.push(point);
    }
    cycles.push(cycle);
  }
  return cycles;
}
/** The permutation a cycle decomposition describes; undefined when it isn't a canonical one. */
export function PermutationOfCycleDecomposition(cycles: readonly (readonly number[])[]): number[] | undefined {
  const n = cycles.reduce((total, cycle) => total + cycle.length, 0);
  const perm: number[] = Array.from({ length: n }, () => 0);
  for (const cycle of cycles)
    for (let i = 0; i < cycle.length; i++) {
      const point = cycle[i]!;
      if (!Number.isInteger(point) || point < 1 || point > n || perm[point - 1] !== 0) return undefined;
      perm[point - 1] = cycle[(i + 1) % cycle.length]!;
    }
  const canonical = CycleDecomposition(perm);
  return JSON.stringify(canonical) === JSON.stringify(cycles) ? perm : undefined;
}
const cycleTypeOf = (cycles: readonly (readonly number[])[]): number[] =>
  cycles.map((cycle) => cycle.length).toSorted((a, b) => b - a);
const lexCompare = (a: readonly (readonly number[])[], b: readonly (readonly number[])[]): number => {
  const flat = (cycles: readonly (readonly number[])[]) => cycles.flatMap((cycle) => [...cycle, 0]);
  const x = flat(a);
  const y = flat(b);
  for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i]! - y[i]!;
  return x.length - y.length;
};
const cycleListing = new Map<number, { list: number[][][]; rank: Map<string, number> }>();
function cyclesListed(n: number): { list: number[][][]; rank: Map<string, number> } {
  let listed = cycleListing.get(n);
  if (listed === undefined) {
    const list = Array.from({ length: Factorial(n) }, (_, r) => CycleDecomposition(PermutationUnrank(n, r)))
      .map((cycles) => ({ cycles, type: IntegerPartitionRank(cycleTypeOf(cycles), n) }))
      .toSorted((a, b) => a.type - b.type || lexCompare(a.cycles, b.cycles))
      .map(({ cycles }) => cycles);
    listed = { list, rank: new Map(list.map((cycles, r) => [JSON.stringify(cycles), r])) };
    cycleListing.set(n, listed);
  }
  return listed;
}
export const PermutationsAsCyclesFamily: NumberKernel = {
  declared: {
    carrier: "CycleDecomposition",
    params: [{ name: "n", role: "axis", min: 0 }],
    cost: { count: "closed", unrank: "enumerative", rank: "enumerative", valid: "polynomial" },
    work: ([n]) => BigInt(Factorial(n!)),
  },
  head: "PermutationsAsCycles",
  paramCount: 1,
  kind: "blocks",
  carrier: "CycleDecomposition",
  count: ([n]) => Factorial(n!),
  unrank: ([n], r) => cyclesListed(n!).list[Number(r)]!,
  valid: (e, [n]) => Array.isArray(e) && (PermutationOfCycleDecomposition(e as number[][])?.length ?? -1) === n,
  rank: (e, [n]) => cyclesListed(n!).rank.get(JSON.stringify(e)) ?? -1,
};

export const entries: (NumberKernel | EpsilFamily)[] = [
  // Defined in Epsil (./closed-forms.ts); the kernels above are the readings tests/readings/ holds them to.
  evenPermutations,
  arrangements,
  permutationsAsCycles,
  lehmerCodes,
  subexcedantSeqs,
  alternatingPermutations,
  connectedPermutations,
  kCyclePermutations,
  kDescentPermutations,
  kInversionPermutationsFast,
  ...permutationsAvoiding3,
];
