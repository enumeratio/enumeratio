---
name: LongCycleConjugation
domain: Combinatorial maps
signature: LongCycleConjugation(Permutation)
summary: "Conjugation by the long cycle (1 2 ... n): each cycle's entries shifted up by one, cyclically."
catalog:
  - system: findstat
    identity: Mp00265
    url: https://www.findstat.org/Mp00265
    on: Permutation
mapOn:
  - Permutation
signatures:
  - call: LongCycleConjugation(Permutation)
    description: "Conjugation by the long cycle (1 2 ... n): each cycle's entries shifted up by one, cyclically."
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
- Reflects the permutation's cycle diagram around the circle one step; it fixes the cycle type, and its n-th power is the identity.
