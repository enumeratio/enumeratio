---
name: Excedances
domain: Permutation statistics
signature: Excedances(p)
summary: "The number of excedances of $p$: positions $i$ with $p_i > i$."
signatures:
  - call: Excedances(p)
    description: the excedance count of a one-line permutation $p$
    library: enumeratio-combinatorics
    type: (permutation) -> integer
seeAlso:
  - Antiexcedances
  - Descents
  - SymmetricGroup
references:
  - system: wikipedia
    identity: Permutation#Ascents, descents, runs, exceedances
catalog:
  - system: findstat
    identity: St000155
    url: https://www.findstat.org/St000155
    on: Permutation
statOn:
  - DecoratedPermutation
  - Permutation
---

- Equidistributed with [[Descents]] over $S_n$: both are Eulerian statistics
- A fixed point is neither an excedance nor an antiexcedance, so $\mathrm{Excedances} + \mathrm{Antiexcedances} + \mathrm{FixedPoints} = n$
- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
