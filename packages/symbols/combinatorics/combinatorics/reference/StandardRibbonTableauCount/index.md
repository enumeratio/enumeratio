---
name: StandardRibbonTableauCount
domain: Composition statistics
signature: StandardRibbonTableauCount(composition)
summary: "Standard fillings of the ribbon whose rows have these lengths: the permutations of 1 .. n with these partial sums as their descents."
catalog:
  - system: findstat
    identity: St000277
    url: https://www.findstat.org/St000277
    on: Composition
statOn:
  - Composition
signatures:
  - call: StandardRibbonTableauCount(composition)
    description: "Standard fillings of the ribbon whose rows have these lengths: the permutations of 1 .. n with these partial sums as their descents."
    library: enumeratio-combinatorics
    type: (composition) -> number
---

- Defined over `Composition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Composition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Stanley, Enumerative Combinatorics, volume 1, section 1.4: Proposition 1.4.1 counts permutations whose descents lie in a set, and inclusion-exclusion over it gives this count. FindStat cites the formula as section 14.4.
