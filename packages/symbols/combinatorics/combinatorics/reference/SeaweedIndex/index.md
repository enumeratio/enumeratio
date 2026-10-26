---
name: SeaweedIndex
domain: Composition statistics
signature: SeaweedIndex(composition)
summary: "Twice the cycles plus the paths, less one, of the meander of the composition over the single block: the index of the maximal parabolic seaweed algebra."
catalog:
  - system: findstat
    identity: St001263
    url: https://www.findstat.org/St001263
    on: Composition
statOn:
  - Composition
signatures:
  - call: SeaweedIndex(composition)
    description: "Twice the cycles plus the paths, less one, of the meander of the composition over the single block: the index of the maximal parabolic seaweed algebra."
    library: enumeratio-combinatorics
    type: (composition) -> number
---

- Defined over `Composition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Composition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Dergachev and Kirillov, Index of Lie algebras of seaweed type. FindStat's code builds the meander as a simple graph, so two dots joined by an arc above and one below are a path, not a cycle; the definition follows the code, not the prose. The empty composition is outside FindStat's rows.
