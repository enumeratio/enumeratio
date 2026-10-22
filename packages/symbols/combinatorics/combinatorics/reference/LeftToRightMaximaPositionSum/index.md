---
name: LeftToRightMaximaPositionSum
domain: Permutation statistics
signature: LeftToRightMaximaPositionSum(p)
summary: The sum of the positions of the left-to-right maxima.
signatures:
  - call: LeftToRightMaximaPositionSum(p)
    description: The sum of the positions of the left-to-right maxima.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
