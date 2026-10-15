---
name: RightOuterPeaks
domain: Permutation statistics
signature: RightOuterPeaks(p)
summary: "Peaks of the word p(1) ... p(n) 0: the interior peaks, plus one when p(n) > p(n-1)."
catalog:
  - system: findstat
    identity: St000834
    url: https://www.findstat.org/St000834
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: RightOuterPeaks(p)
    description: "Peaks of the word p(1) ... p(n) 0: the interior peaks, plus one when p(n) > p(n-1)."
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
