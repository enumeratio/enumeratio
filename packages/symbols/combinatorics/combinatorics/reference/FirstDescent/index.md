---
name: FirstDescent
domain: Permutation statistics
signature: FirstDescent(p)
summary: The smallest descent position, or n when p is increasing.
statOn:
  - Permutation
catalog:
  - system: findstat
    identity: St000654
    url: https://www.findstat.org/St000654
    on: Permutation
seeAlso:
  - FirstAscent
  - Descents
signatures:
  - call: FirstDescent(p)
    description: The smallest descent position, or $n$ when $p$ is increasing.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
- FindStat St000654: p(n+1) = 0, so position n always descends.
