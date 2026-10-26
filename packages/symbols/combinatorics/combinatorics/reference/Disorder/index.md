---
name: Disorder
domain: Permutation statistics
signature: Disorder(p)
summary: "Scanning cyclically for 1, then 2, ...: the entries passed that are still larger than the one sought."
catalog:
  - system: findstat
    identity: St000446
    url: https://www.findstat.org/St000446
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: Disorder(p)
    description: "Scanning cyclically for 1, then 2, ...: the entries passed that are still larger than the one sought."
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
