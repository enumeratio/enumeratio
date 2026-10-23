---
name: OccurrencesOf213
domain: Permutation statistics
signature: OccurrencesOf213(p)
summary: Triples i < j < k with p(j) < p(i) < p(k).
formerly:
  - NumberOfOccurrencesOf213
signatures:
  - call: OccurrencesOf213(p)
    description: Triples i < j < k with p(j) < p(i) < p(k).
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
bindings:
  - origin: mapped
    form: sage
    template: enumeratio_stat("Permutation", $1, "OccurrencesOf213")
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
catalog:
  - system: findstat
    identity: St000218
    url: https://www.findstat.org/St000218
    on: Permutation
statOn:
  - Permutation
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
