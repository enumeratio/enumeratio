---
name: Tier
domain: Permutation statistics
signature: Tier(p)
summary: Positions a with a larger entry, then the value p(a) - 1, to its right.
catalog:
  - system: findstat
    identity: St000779
    url: https://www.findstat.org/St000779
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: Tier(p)
    description: Positions a with a larger entry, then the value p(a) - 1, to its right.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
