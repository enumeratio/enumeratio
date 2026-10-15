---
name: LeftOuterPeaks
domain: Permutation statistics
signature: LeftOuterPeaks(p)
summary: "Peaks of the word 0 p(1) ... p(n): the interior peaks, plus one when p(1) > p(2)."
catalog:
  - system: findstat
    identity: St000035
    url: https://www.findstat.org/St000035
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: LeftOuterPeaks(p)
    description: "Peaks of the word 0 p(1) ... p(n): the interior peaks, plus one when p(1) > p(2)."
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
