---
name: PositionsOfLetterThreeIn132
domain: Permutation statistics
signature: PositionsOfLetterThreeIn132(p)
summary: Positions that are the middle of an occurrence of 132.
catalog:
  - system: findstat
    identity: St001683
    url: https://www.findstat.org/St001683
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: PositionsOfLetterThreeIn132(p)
    description: Positions that are the middle of an occurrence of 132.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
