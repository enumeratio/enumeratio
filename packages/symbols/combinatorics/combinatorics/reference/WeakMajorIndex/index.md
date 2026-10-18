---
name: WeakMajorIndex
domain: Composition statistics
signature: WeakMajorIndex(composition)
summary: The sum of the positions i with c(i) >= c(i+1).
catalog:
  - system: findstat
    identity: St001931
    url: https://www.findstat.org/St001931
    on: Composition
statOn:
  - Composition
signatures:
  - call: WeakMajorIndex(composition)
    description: The sum of the positions i with c(i) >= c(i+1).
    library: enumeratio-combinatorics
    type: (composition | list<integer>) -> number
---

- Defined over `Composition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Composition`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
- Reads the composition as a word, so it stands on a bare list too.
