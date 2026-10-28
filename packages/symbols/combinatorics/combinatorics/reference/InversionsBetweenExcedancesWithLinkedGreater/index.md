---
name: InversionsBetweenExcedancesWithLinkedGreater
domain: Permutation statistics
signature: InversionsBetweenExcedancesWithLinkedGreater(p)
summary: Pairs i < j < p(j) < p(i) with p^-1(j) < j.
catalog:
  - system: findstat
    identity: St001550
    url: https://www.findstat.org/St001550
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: InversionsBetweenExcedancesWithLinkedGreater(p)
    description: Pairs i < j < p(j) < p(i) with p^-1(j) < j.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
