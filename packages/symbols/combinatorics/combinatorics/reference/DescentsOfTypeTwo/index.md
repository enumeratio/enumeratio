---
name: DescentsOfTypeTwo
domain: Permutation statistics
signature: DescentsOfTypeTwo(p)
summary: Descents i with p(i) larger than everything before it.
catalog:
  - system: findstat
    identity: St001737
    url: https://www.findstat.org/St001737
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: DescentsOfTypeTwo(p)
    description: Descents i with p(i) larger than everything before it.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
