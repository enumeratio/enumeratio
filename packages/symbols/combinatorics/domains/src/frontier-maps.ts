// Maps the catalog has that are NOT defined yet, with the reason — the same discipline the
// statistics frontier uses: nothing is silently missing.
//
// FromPermutation left here once, reason "a catalog alias whose source collection is
// ambiguous": the catalog dump folds map rows to bare names with an overload set (`on`), no
// source-collection field, so which collection's "FromPermutation" this was looked
// unrecoverable. It wasn't — `ToPermutation`'s own overload set names `IncreasingBinaryTrees`
// among its sources, and `FromPermutation`'s title ("Minimum-splitting recursion → increasing
// binary tree") is exactly that map's inverse: the Cartesian tree on a permutation's values,
// min-heap ordered. Defined in increasing-binary-tree.ts, declared in map.ts.
//
// Two entries that lived here — CyclePartition and DescentComposition — are gone. Both had
// been written, evaluated and REMOVED rather than shipped wrong, and both came back once the
// two rules that broke them were known: iterate over a RANGE and index (tableau.ts), and
// state the short cases, because `Range(1, 0)` and `Range(1, 1)` never evaluate.
//
// Neither was ever hard. They were written before the rules were understood, which is a
// different thing from being out of reach — and worth remembering when reading what is left. Statistics hit this too (see the `atLeast`
// guards in @enumeratio/statistics), but a map building a list of variable length hits it
// harder: the guard has to cover every stage of the pipeline, not just the outer result.
//
// The RSK entries are gone entirely. What blocked them was never the growing accumulator —
// that works — but a laziness rule now documented in tableau.ts: iterate over a RANGE and
// index, never fold or filter over a list taken out of the accumulator. The recording tableau
// then needed no new mechanism at all: comparing row lengths before and after says which row
// grew, so the insertion logic stayed untouched.
//
// ConjugateAfterCycleType and ConjugacyClassRepresentative are also gone: both were genuinely
// blocked on CyclePartition, and once that map existed they were the same index-not-fold
// construction as everything else here — cumulative block sizes from cycle lengths, block
// membership read off by counting, never a fold over a variable-length grouping. Foata is
// gone too, built the same way: block boundaries from cycle lengths ordered by cycle MAXIMUM
// rather than minimum, values read off by iterating the permutation from each block's leader.

export interface UndefinedMap {
  readonly name: string;
  readonly from: string;
  readonly to: string;
  readonly why: string;
}

export const UNDEFINED_MAPS: readonly UndefinedMap[] = [
  {
    name: "PermutahedronVertex",
    from: "permutation",
    to: "finset",
    why: "Not a geometric embedding this repo's carriers can hold honestly: the vertex (σ(1), …, σ(n)) — or the Loday point packages/symbols/combinatorics/polytope/src/permutahedron.ts already computes — is an ORDERED tuple of coordinates, and `finset` (domain-data.ts: `tuple<list<integer>, integer>`) is an unordered SET of positions, the same carrier DescentSet and PeakSet use. Reordering the coordinates gives a different vertex but the same finset, so the map would not even be injective, let alone honest. A `finset`-valued PermutahedronVertex is a type mismatch dressed as a definition, not a gap to close.",
  },
];
