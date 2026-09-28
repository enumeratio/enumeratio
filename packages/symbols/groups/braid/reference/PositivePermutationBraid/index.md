---
name: PositivePermutationBraid
domain: Braids and knots
signature: PositivePermutationBraid(permutation)
summary: The unique positive braid realising a permutation in which no pair of strands crosses more than once.
signatures:
  - call: PositivePermutationBraid(permutation)
    description: the positive braid with no pair crossing twice
    library: enumeratio-braid
    type: (list<integer>) -> expression<Braid>
seeAlso:
  - BraidPermutation
  - LorenzBraid
---
