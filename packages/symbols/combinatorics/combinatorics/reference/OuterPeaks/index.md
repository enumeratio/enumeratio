---
name: OuterPeaks
domain: Permutation statistics
signature: OuterPeaks(p)
summary: "Peaks of the word 0 p(1) ... p(n) 0: the interior peaks, plus one for each end that is a peak."
catalog:
  - system: findstat
    identity: St000092
    url: https://www.findstat.org/St000092
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: OuterPeaks(p)
    description: "Peaks of the word 0 p(1) ... p(n) 0: the interior peaks, plus one for each end that is a peak."
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
