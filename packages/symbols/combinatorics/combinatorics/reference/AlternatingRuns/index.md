---
name: AlternatingRuns
domain: Permutation statistics
signature: AlternatingRuns(p)
summary: The interior peaks plus the interior valleys.
catalog:
  - system: findstat
    identity: St000483
    url: https://www.findstat.org/St000483
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: AlternatingRuns(p)
    description: The interior peaks plus the interior valleys.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
- FindStat's title: the times the word switches from increasing to decreasing or back.
