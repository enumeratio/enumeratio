---
name: WeakExcedanceMidPointsOfOccurrencesOf321
domain: Permutation statistics
signature: WeakExcedanceMidPointsOfOccurrencesOf321(p)
summary: Positions i with p(i) >= i that are the middle of a 321 occurrence.
catalog:
  - system: findstat
    identity: St000373
    url: https://www.findstat.org/St000373
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: WeakExcedanceMidPointsOfOccurrencesOf321(p)
    description: Positions i with p(i) >= i that are the middle of a 321 occurrence.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
