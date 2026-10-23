---
name: ReflectionLength
domain: Permutation statistics
signature: ReflectionLength(p)
summary: n minus the number of cycles — the minimum number of transpositions.
statOn:
  - Permutation
signatures:
  - call: ReflectionLength(p)
    description: n minus the number of cycles — the minimum number of transpositions.
    library: enumeratio-combinatorics
    type: (permutation) -> number
bindings:
  - origin: mapped
    form: sage
    template: enumeratio_stat("Permutation", $1, "ReflectionLength")
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
catalog:
  - system: findstat
    identity: St000216
    url: https://www.findstat.org/St000216
    on: Permutation
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
