---
name: AscentBottomSum
domain: Permutation statistics
signature: AscentBottomSum(p)
summary: "The sum of the ascent bottoms: p(i) over the ascents i."
catalog:
  - system: findstat
    identity: St000472
    url: https://www.findstat.org/St000472
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: AscentBottomSum(p)
    description: "The sum of the ascent bottoms: p(i) over the ascents i."
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
