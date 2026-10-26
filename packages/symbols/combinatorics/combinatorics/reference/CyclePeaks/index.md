---
name: CyclePeaks
domain: Permutation statistics
signature: CyclePeaks(p)
summary: Values i with p^-1(i) < i > p(i).
catalog:
  - system: findstat
    identity: St000994
    url: https://www.findstat.org/St000994
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: CyclePeaks(p)
    description: Values i with p^-1(i) < i > p(i).
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Every cycle has as many peaks as valleys, so this is the cycle valleys too.
