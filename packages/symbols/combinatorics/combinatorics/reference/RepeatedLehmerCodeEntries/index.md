---
name: RepeatedLehmerCodeEntries
domain: Permutation statistics
signature: RepeatedLehmerCodeEntries(p)
summary: The Lehmer code's length less its number of distinct entries.
catalog:
  - system: findstat
    identity: St001298
    url: https://www.findstat.org/St001298
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: RepeatedLehmerCodeEntries(p)
    description: The Lehmer code's length less its number of distinct entries.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
