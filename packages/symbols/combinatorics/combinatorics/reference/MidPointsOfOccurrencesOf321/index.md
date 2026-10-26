---
name: MidPointsOfOccurrencesOf321
domain: Permutation statistics
signature: MidPointsOfOccurrencesOf321(p)
summary: "Positions that are the middle of a 321 occurrence: neither a left-to-right maximum nor a right-to-left minimum."
catalog:
  - system: findstat
    identity: St000371
    url: https://www.findstat.org/St000371
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: MidPointsOfOccurrencesOf321(p)
    description: "Positions that are the middle of a 321 occurrence: neither a left-to-right maximum nor a right-to-left minimum."
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
