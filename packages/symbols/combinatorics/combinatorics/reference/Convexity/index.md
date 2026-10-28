---
name: Convexity
domain: Permutation statistics
signature: Convexity(p)
summary: The largest 2 p(i) - p(i-1) - p(i+1) over the interior positions, or 0.
catalog:
  - system: findstat
    identity: St000226
    url: https://www.findstat.org/St000226
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: Convexity(p)
    description: The largest 2 p(i) - p(i-1) - p(i+1) over the interior positions, or 0.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
