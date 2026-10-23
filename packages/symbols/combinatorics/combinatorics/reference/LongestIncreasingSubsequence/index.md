---
name: LongestIncreasingSubsequence
domain: Permutation statistics
signature: LongestIncreasingSubsequence(p)
summary: The length of a longest increasing subsequence.
references:
  - system: wikipedia
    identity: Longest increasing subsequence
  - system: rosettacode
    identity: Longest increasing subsequence
statOn:
  - Permutation
signatures:
  - call: LongestIncreasingSubsequence(p)
    description: The length of a longest increasing subsequence.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
bindings:
  - origin: mapped
    form: combinatorica
    template: Length[LongestIncreasingSubsequence[$1]]
    arity: 1
    note: Combinatorica returns a longest subsequence; ours is its length.
  - origin: mapped
    form: sage
    template: enumeratio_stat("Permutation", $1, "LongestIncreasingSubsequence")
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
catalog:
  - system: findstat
    identity: St000062
    url: https://www.findstat.org/St000062
    on: Permutation
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
- By patience sorting: the number of piles. Checked against the piles algorithm over every permutation of 1..6.
