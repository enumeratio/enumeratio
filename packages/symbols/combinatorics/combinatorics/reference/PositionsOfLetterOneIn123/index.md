---
name: PositionsOfLetterOneIn123
domain: Permutation statistics
signature: PositionsOfLetterOneIn123(p)
summary: Positions that start an occurrence of 123.
catalog:
  - system: findstat
    identity: St001682
    url: https://www.findstat.org/St001682
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: PositionsOfLetterOneIn123(p)
    description: Positions that start an occurrence of 123.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
