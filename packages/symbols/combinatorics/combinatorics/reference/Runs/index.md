---
name: Runs
domain: Permutation statistics
signature: Runs(p)
summary: Maximal increasing runs — one more than the number of descents.
references:
  - system: wikipedia
    identity: Permutation#Ascents, descents, runs, exceedances
  - system: mathworld
    identity: PermutationRun
statOn:
  - BinaryWord
  - Permutation
signatures:
  - call: Runs(p)
    description: Maximal increasing runs — one more than the number of descents.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
