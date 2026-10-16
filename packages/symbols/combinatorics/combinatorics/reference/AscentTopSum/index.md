---
name: AscentTopSum
domain: Permutation statistics
signature: AscentTopSum(p)
summary: "The sum of the ascent tops: p(i+1) over the ascents i."
catalog:
  - system: findstat
    identity: St000471
    url: https://www.findstat.org/St000471
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: AscentTopSum(p)
    description: "The sum of the ascent tops: p(i+1) over the ascents i."
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
