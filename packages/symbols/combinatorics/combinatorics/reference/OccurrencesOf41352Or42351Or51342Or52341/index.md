---
name: OccurrencesOf41352Or42351Or51342Or52341
domain: Permutation statistics
signature: OccurrencesOf41352Or42351Or51342Or52341(p)
summary: Quintuples ordered as 41352, 42351, 51342 or 52341.
catalog:
  - system: findstat
    identity: St001059
    url: https://www.findstat.org/St001059
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: OccurrencesOf41352Or42351Or51342Or52341(p)
    description: Quintuples ordered as 41352, 42351, 51342 or 52341.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
