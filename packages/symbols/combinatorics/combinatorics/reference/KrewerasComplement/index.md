---
name: KrewerasComplement
domain: Combinatorial maps
signature: KrewerasComplement(Permutation)
summary: "π⁻¹c with the long cycle c = (1 2 ... n), FindStat's order: position i holds c(π⁻¹(i))."
references:
  - system: wikipedia
    identity: Noncrossing partition
catalog:
  - system: findstat
    identity: Mp00088
    url: https://www.findstat.org/Mp00088
    on: Permutation
  - system: findstat
    identity: Mp00168
    url: https://www.findstat.org/Mp00168
    on: SignedPermutation
mapOn:
  - Permutation
  - SignedPermutation
signatures:
  - call: KrewerasComplement(Permutation)
    description: "w⁻¹c with the long cycle c = (1 2 ... n), FindStat's order: position i holds c(w⁻¹(i))."
    library: enumeratio-combinatorics
    type: ((permutation) -> permutation) & ((signed_permutation) -> signed_permutation)
laws:
  - bijection
  - graded:
      from: Permutations
      to: Permutations
    on: permutation
  - graded:
      from: SignedPermutations
      to: SignedPermutations
    on: signed_permutation
---

- Takes a `Permutation` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- Total, a bijection of S_n; it restricts to the classical Kreweras complement of the non-crossing permutations (those below c in absolute order), mapping NC(n) onto itself. K∘K is conjugation by c.
- Also takes a `SignedPermutation`, returning a `SignedPermutation`: π⁻¹c with the long cycle c = (1 … n −1 … −n): position i holds c(π⁻¹(i)).
- FindStat's Mp00168. A bijection of order 2n.
