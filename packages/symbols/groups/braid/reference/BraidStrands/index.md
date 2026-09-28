---
name: BraidStrands
domain: Braids and knots
signature: BraidStrands(braid)
summary: The strand count $n$ of a braid in $B_n$.
signatures:
  - call: BraidStrands(braid)
    description: the strand count $n$
    library: enumeratio-braid
    type: (expression<Braid> | string) -> integer
seeAlso:
  - BraidCrossings
---
