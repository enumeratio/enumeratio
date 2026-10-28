---
name: OneBoxPatterns
domain: Permutation statistics
signature: OneBoxPatterns(p)
summary: Positions i with a neighbouring entry, left or right, differing from p(i) by exactly 1.
catalog:
  - system: findstat
    identity: St000064
    url: https://www.findstat.org/St000064
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: OneBoxPatterns(p)
    description: Positions i with a neighbouring entry, left or right, differing from p(i) by exactly 1.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
