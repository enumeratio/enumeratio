---
name: ArithmeticProgressionsOfLengthTwo
domain: Permutation statistics
signature: ArithmeticProgressionsOfLengthTwo(p)
summary: Triples i < j < k with p(k) - p(j) = p(j) - p(i).
signatures:
  - call: ArithmeticProgressionsOfLengthTwo(p)
    description: Triples i < j < k with p(k) - p(j) = p(j) - p(i).
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
catalog:
  - system: findstat
    identity: St001565
    url: https://www.findstat.org/St001565
    on: Permutation
statOn:
  - Permutation
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
