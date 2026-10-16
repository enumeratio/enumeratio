---
name: FirstAscent
domain: Permutation statistics
signature: FirstAscent(p)
summary: The smallest ascent position, or n when p is decreasing.
statOn:
  - Permutation
catalog:
  - system: findstat
    identity: St000990
    url: https://www.findstat.org/St000990
    on: Permutation
seeAlso:
  - FirstDescent
  - Ascents
signatures:
  - call: FirstAscent(p)
    description: The smallest ascent position, or $n$ when $p$ is decreasing.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
- FindStat St000990.
