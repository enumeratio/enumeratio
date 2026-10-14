---
name: Compare
domain: Structures
signature: Compare(a, b)
summary: "How two values of a partially ordered type compare: -1, 0 or 1, or NaN when they are incomparable."
signatures:
  - call: Compare(a, b)
    description: "How two values of a partially ordered type compare: -1, 0 or 1, or NaN when they are incomparable."
    library: enumeratio-structures
    type: (any, any) -> unknown
seeAlso:
  - Min
  - Max
  - GreatestLowerBound
---

- The `PartialOrder` protocol's member: a type conforms by saying how it compares two of its values.
- Reflexive, antisymmetric and transitive; a `LinearOrder` never answers NaN.
- Under dominance, $[3,1,1,1]$ and $[2,2,2]$ are incomparable: NaN.
- Set partitions of one ground set under refinement (finer is lower): NaN unless one refines the other.
- Permutations of one length under the right weak order, as Sage's `permutohedron_lequal` (default `side="right"`): p is below q when every inversion of p, a pair of values a < b with b first, is one of q's. The left order is this one on inverses.
