---
name: DyckPathsAboveBouncePathCount
domain: Composition statistics
signature: DyckPathsAboveBouncePathCount(composition)
summary: "Dyck paths of semilength n that stay weakly above the bounce path of the composition: their area sequences are at least 0 .. c_1 - 1, 0 .. c_2 - 1, ...."
catalog:
  - system: findstat
    identity: St001312
    url: https://www.findstat.org/St001312
    on: Composition
statOn:
  - Composition
signatures:
  - call: DyckPathsAboveBouncePathCount(composition)
    description: "Dyck paths of semilength n that stay weakly above the bounce path of the composition: their area sequences are at least 0 .. c_1 - 1, 0 .. c_2 - 1, ...."
    library: enumeratio-combinatorics
    type: (composition) -> number
---

- Defined over `Composition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Composition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- FindStat titles it the parabolic noncrossing partitions indexed by the composition (Mühle and Williams) and also the size of a nu-Tamari lattice (Bergeron, Ceballos and Pilaud); its code counts these Dyck paths.
