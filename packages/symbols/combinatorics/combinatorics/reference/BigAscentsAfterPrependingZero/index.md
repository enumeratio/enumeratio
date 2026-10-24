---
name: BigAscentsAfterPrependingZero
domain: Permutation statistics
signature: BigAscentsAfterPrependingZero(p)
summary: Positions of the word 0 p(1) ... p(n) that rise by more than 1, the first entry counted against 0.
signatures:
  - call: BigAscentsAfterPrependingZero(p)
    description: Positions of the word 0 p(1) ... p(n) that rise by more than 1, the first entry counted against 0.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
catalog:
  - system: findstat
    identity: St000742
    url: https://www.findstat.org/St000742
    on: Permutation
statOn:
  - Permutation
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
