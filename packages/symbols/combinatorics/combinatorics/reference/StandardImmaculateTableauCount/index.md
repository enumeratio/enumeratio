---
name: StandardImmaculateTableauCount
domain: Composition statistics
signature: StandardImmaculateTableauCount(composition)
summary: "Standard immaculate tableaux of the shape: fillings of 1 .. n increasing along the rows and down the first column."
catalog:
  - system: findstat
    identity: St000047
    url: https://www.findstat.org/St000047
    on: Composition
statOn:
  - Composition
signatures:
  - call: StandardImmaculateTableauCount(composition)
    description: "Standard immaculate tableaux of the shape: fillings of 1 .. n increasing along the rows and down the first column."
    library: enumeratio-combinatorics
    type: (composition) -> number
---

- Defined over `Composition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Composition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Berg, Bergeron, Saliola, Serrano and Zabrocki, A lift of the Schur and Hall-Littlewood bases to non-commutative symmetric functions (Proposition 3.13).
