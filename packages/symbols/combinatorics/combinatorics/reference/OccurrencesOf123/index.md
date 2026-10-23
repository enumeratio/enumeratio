---
name: OccurrencesOf123
domain: Permutation statistics
signature: OccurrencesOf123(p)
summary: Triples i < j < k with p(i) < p(j) < p(k).
statOn:
  - Permutation
signatures:
  - call: OccurrencesOf123(p)
    description: Triples i < j < k with p(i) < p(j) < p(k).
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
bindings:
  - origin: mapped
    form: sage
    template: enumeratio_stat("Permutation", $1, "OccurrencesOf123")
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
catalog:
  - system: findstat
    identity: St000002
    url: https://www.findstat.org/St000002
    on: Permutation
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
