---
name: PositionsOfLetterTwoIn213
domain: Permutation statistics
signature: PositionsOfLetterTwoIn213(p)
summary: Positions that start an occurrence of 213.
catalog:
  - system: findstat
    identity: St001687
    url: https://www.findstat.org/St001687
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: PositionsOfLetterTwoIn213(p)
    description: Positions that start an occurrence of 213.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
