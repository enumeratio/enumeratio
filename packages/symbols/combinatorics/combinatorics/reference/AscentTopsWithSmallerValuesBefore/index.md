---
name: AscentTopsWithSmallerValuesBefore
domain: Permutation statistics
signature: AscentTopsWithSmallerValuesBefore(p)
summary: Ascents i whose top p(i+1) has every smaller value among p(1), ..., p(i).
catalog:
  - system: findstat
    identity: St001640
    url: https://www.findstat.org/St001640
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: AscentTopsWithSmallerValuesBefore(p)
    description: Ascents i whose top p(i+1) has every smaller value among p(1), ..., p(i).
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
