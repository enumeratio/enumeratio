---
name: KrewerasComplement
domain: Combinatorial maps
signature: KrewerasComplement(Permutation)
summary: "w⁻¹c with the long cycle c = (1 2 ... n), FindStat's order: position i holds c(w⁻¹(i))."
references:
  - system: wikipedia
    identity: Noncrossing partition
catalog:
  - system: findstat
    identity: Mp00088
    url: https://www.findstat.org/Mp00088
    on: Permutation
mapOn:
  - Permutation
signatures:
  - call: KrewerasComplement(Permutation)
    description: "w⁻¹c with the long cycle c = (1 2 ... n), FindStat's order: position i holds c(w⁻¹(i))."
    library: enumeratio-combinatorics
    type: (permutation) -> permutation
laws:
  - bijection
  - graded:
      from: Permutations
      to: Permutations
    on: permutation
---

- Takes a `Permutation` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- Total, and a bijection of S_n. On the non-crossing permutations (those below c in absolute order) it is the classical Kreweras complement and maps NC(n) onto itself. K∘K is conjugation by c.
- Composition follows FindStat's Mp00088 (Sage's left-to-right product): π⁻¹ first, then c.
