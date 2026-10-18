---
name: AscentVariation
domain: Composition statistics
signature: AscentVariation(composition)
summary: The sum of c(i+1) - c(i) over the positions where it is positive.
catalog:
  - system: findstat
    identity: St000091
    url: https://www.findstat.org/St000091
    on: Composition
statOn:
  - Composition
signatures:
  - call: AscentVariation(composition)
    description: The sum of c(i+1) - c(i) over the positions where it is positive.
    library: enumeratio-combinatorics
    type: (composition) -> number
---

- Defined over `Composition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Composition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Archibald, Knopfmacher and Mansour, Variation statistics on compositions. FindStat titles it the descent variation; it sums the rises, which is equidistributed with the sum of the falls under reversal.
