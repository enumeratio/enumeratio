---
name: EvenWeakDeficienciesAndOddWeakExcedances
domain: Permutation statistics
signature: EvenWeakDeficienciesAndOddWeakExcedances(p)
summary: Positions i with p(i) <= i for even i, and p(i) >= i for odd i.
catalog:
  - system: findstat
    identity: St001439
    url: https://www.findstat.org/St001439
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: EvenWeakDeficienciesAndOddWeakExcedances(p)
    description: Positions i with p(i) <= i for even i, and p(i) >= i for odd i.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
