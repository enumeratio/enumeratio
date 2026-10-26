---
name: StandardCompositionTableauCount
domain: Composition statistics
signature: StandardCompositionTableauCount(composition)
summary: "Standard composition tableaux of the shape: fillings of 1 .. n with rows decreasing, the first column increasing, and the triple rule."
catalog:
  - system: findstat
    identity: St000816
    url: https://www.findstat.org/St000816
    on: Composition
statOn:
  - Composition
signatures:
  - call: StandardCompositionTableauCount(composition)
    description: "Standard composition tableaux of the shape: fillings of 1 .. n with rows decreasing, the first column increasing, and the triple rule."
    library: enumeratio-combinatorics
    type: (composition) -> number
---

- Defined over `Composition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Composition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Luoto, Mykytiuk and van Willigenburg, An introduction to quasisymmetric Schur functions (Definition 4.2.6).
