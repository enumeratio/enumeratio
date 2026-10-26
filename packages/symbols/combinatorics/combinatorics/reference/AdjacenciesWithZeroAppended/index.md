---
name: AdjacenciesWithZeroAppended
domain: Permutation statistics
signature: AdjacenciesWithZeroAppended(p)
summary: Positions i with p(i) = p(i+1) + 1, reading p(n+1) = 0.
catalog:
  - system: findstat
    identity: St000215
    url: https://www.findstat.org/St000215
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: AdjacenciesWithZeroAppended(p)
    description: Positions i with p(i) = p(i+1) + 1, reading p(n+1) = 0.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
- Adjacencies counts the same without the appended zero.
