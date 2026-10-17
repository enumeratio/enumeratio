---
name: LongestWeaklyIncreasingSubsequence
domain: Composition statistics
signature: LongestWeaklyIncreasingSubsequence(composition)
summary: The length of a longest weakly increasing subsequence of the parts.
catalog:
  - system: findstat
    identity: St000757
    url: https://www.findstat.org/St000757
    on: Composition
statOn:
  - Composition
signatures:
  - call: LongestWeaklyIncreasingSubsequence(composition)
    description: The length of a longest weakly increasing subsequence of the parts.
    library: enumeratio-combinatorics
    type: (composition) -> number
---

- Defined over `Composition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Composition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- The first row of the RSK shape of the composition as a word.
