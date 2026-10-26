---
name: FirstDirectSummandSize
domain: Permutation statistics
signature: FirstDirectSummandSize(p)
summary: The smallest k with {p(1), ..., p(k)} = {1, ..., k}.
catalog:
  - system: findstat
    identity: St000501
    url: https://www.findstat.org/St000501
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: FirstDirectSummandSize(p)
    description: The smallest k with {p(1), ..., p(k)} = {1, ..., k}.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
