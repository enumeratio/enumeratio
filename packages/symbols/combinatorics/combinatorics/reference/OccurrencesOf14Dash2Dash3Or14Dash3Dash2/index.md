---
name: OccurrencesOf14Dash2Dash3Or14Dash3Dash2
domain: Permutation statistics
signature: OccurrencesOf14Dash2Dash3Or14Dash3Dash2(p)
summary: Adjacent ascents p(i) < p(i+1) with two later entries between them, in either order, counted in pairs.
catalog:
  - system: findstat
    identity: St000709
    url: https://www.findstat.org/St000709
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: OccurrencesOf14Dash2Dash3Or14Dash3Dash2(p)
    description: Adjacent ascents p(i) < p(i+1) with two later entries between them, in either order, counted in pairs.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
