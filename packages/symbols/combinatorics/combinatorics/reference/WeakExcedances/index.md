---
name: WeakExcedances
domain: Permutation statistics
signature: WeakExcedances(p)
summary: Positions with p(i) >= i.
catalog:
  - system: findstat
    identity: St000213
    url: https://www.findstat.org/St000213
    on: Permutation
statOn:
  - DecoratedPermutation
  - Permutation
signatures:
  - call: WeakExcedances(p)
    description: Positions with p(i) >= i.
    library: enumeratio-combinatorics
    type: (permutation) -> number
bindings:
  - origin: mapped
    form: sage
    template: enumeratio_stat("Permutation", $1, "WeakExcedances")
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
