---
name: HertzsprungOccurrencesOf132
domain: Permutation statistics
signature: HertzsprungOccurrencesOf132(p)
summary: Positions i with p(i+1) = p(i) + 2 and p(i+2) = p(i) + 1.
catalog:
  - system: findstat
    identity: St001663
    url: https://www.findstat.org/St001663
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: HertzsprungOccurrencesOf132(p)
    description: Positions i with p(i+1) = p(i) + 2 and p(i+2) = p(i) + 1.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
