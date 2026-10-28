---
name: RestrictedNonInversionsBetweenExcedances
domain: Permutation statistics
signature: RestrictedNonInversionsBetweenExcedances(p)
summary: Pairs i < j < p(i) < p(j).
catalog:
  - system: findstat
    identity: St001549
    url: https://www.findstat.org/St001549
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: RestrictedNonInversionsBetweenExcedances(p)
    description: Pairs i < j < p(i) < p(j).
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
