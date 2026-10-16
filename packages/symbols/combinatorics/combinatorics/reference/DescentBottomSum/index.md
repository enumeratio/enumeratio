---
name: DescentBottomSum
domain: Permutation statistics
signature: DescentBottomSum(p)
summary: "The sum of the descent bottoms: p(i+1) over the descents i."
catalog:
  - system: findstat
    identity: St000154
    url: https://www.findstat.org/St000154
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: DescentBottomSum(p)
    description: "The sum of the descent bottoms: p(i+1) over the descents i."
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
