---
name: Successions
domain: Permutation statistics
signature: Successions(p)
summary: "Permutation: positions i with p(i+1) = p(i) + 1. SetPartition: elements i with i + 1 in the same block."
catalog:
  - system: findstat
    identity: St000441
    url: https://www.findstat.org/St000441
    on: Permutation
  - system: findstat
    identity: St000502
    url: https://www.findstat.org/St000502
    on: SetPartition
statOn:
  - Permutation
  - SetPartition
signatures:
  - call: Successions(p)
    description: "Permutation: positions i with p(i+1) = p(i) + 1. SetPartition: elements i with i + 1 in the same block."
    library: enumeratio-combinatorics
    type: (list<integer> | permutation | set_partition) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Also called small ascents or 1-rises.
