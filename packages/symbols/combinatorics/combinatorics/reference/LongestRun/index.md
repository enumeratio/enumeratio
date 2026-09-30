---
name: LongestRun
domain: Permutation statistics
signature: LongestRun(p)
summary: The length of the longest run of consecutive increases.
statOn:
  - Permutation
  - Word
signatures:
  - call: LongestRun(p)
    description: The length of the longest run of consecutive increases.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
- Expressed with Fold — which compute-engine does have, contrary to what an earlier version of this package claimed when it put this statistic on the frontier.
