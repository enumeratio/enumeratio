---
name: NonRecords
domain: Permutation statistics
signature: NonRecords(p)
summary: Positions that are none of a left-to-right maximum or minimum, or a right-to-left maximum or minimum.
catalog:
  - system: findstat
    identity: St001715
    url: https://www.findstat.org/St001715
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: NonRecords(p)
    description: Positions that are none of a left-to-right maximum or minimum, or a right-to-left maximum or minimum.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
