---
name: CompositionBouncePath
domain: Combinatorial maps
signature: CompositionBouncePath(Composition)
summary: "The Dyck path that bounces off the diagonal once for each part: a run of that many ups, then as many downs."
catalog:
  - system: findstat
    identity: Mp00231
    url: https://www.findstat.org/Mp00231
    on: Composition
mapOn:
  - Composition
laws:
  - graded:
      from: IntegerCompositions
      to: DyckPaths
    on: composition
signatures:
  - call: CompositionBouncePath(Composition)
    description: "The Dyck path that bounces off the diagonal once for each part: a run of that many ups, then as many downs."
    library: enumeratio-combinatorics
    type: (composition) -> dyck_path
---

- Takes a `Composition` and returns a `DyckPath` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00231. An injection; the paths it reaches are those made of runs of as many downs as ups.
