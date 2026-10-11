---
name: ToPermutation
domain: Combinatorial maps
signature: ToPermutation(StandardTableauPair)
summary: "The permutation an RSK pair comes from: inverse RSK."
mapOn:
  - AffinePermutation
  - IncreasingBinaryTree
  - PermutationCycles
  - PermutationInversion
  - SignedPermutation
  - StandardTableauPair
signatures:
  - call: ToPermutation(StandardTableauPair)
    description: "The permutation an RSK pair of standard tableaux comes from: the inverse of Rsk."
    library: enumeratio-combinatorics
    type: (standard_tableau_pair) -> permutation
laws:
  - inverse: Rsk
---

- Takes a `StandardTableauPair` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- Unbumps the cell holding n in Q, then n − 1, and so on, each time reading a letter off the first row of P.
