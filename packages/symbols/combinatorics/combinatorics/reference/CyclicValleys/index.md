---
name: CyclicValleys
domain: Permutation statistics
signature: CyclicValleys(p)
summary: Positions lower than both neighbours, reading the word cyclically.
catalog:
  - system: findstat
    identity: St000243
    url: https://www.findstat.org/St000243
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: CyclicValleys(p)
    description: Positions lower than both neighbours, reading the word cyclically.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
- As many cyclic peaks as cyclic valleys, so this is both.
