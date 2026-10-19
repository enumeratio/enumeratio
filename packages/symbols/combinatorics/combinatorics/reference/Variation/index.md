---
name: Variation
domain: Composition statistics
signature: Variation(composition)
summary: "The signed sum of c(i+1) - c(i): the last part less the first."
catalog:
  - system: findstat
    identity: St000090
    url: https://www.findstat.org/St000090
    on: Composition
statOn:
  - Composition
signatures:
  - call: Variation(composition)
    description: "The sum of c(i+1) - c(i): the last part less the first."
    library: enumeratio-combinatorics
    type: (composition) -> number
---

- Defined over `Composition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Composition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Archibald, Knopfmacher and Mansour, Variation statistics on compositions.
