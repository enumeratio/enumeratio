---
name: DescentTopSum
domain: Permutation statistics
signature: DescentTopSum(p)
summary: "The sum of the descent tops: p(i) over the descents i."
catalog:
  - system: findstat
    identity: St000111
    url: https://www.findstat.org/St000111
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: DescentTopSum(p)
    description: "The sum of the descent tops: p(i) over the descents i."
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
- Also called the Genocchi descents.
