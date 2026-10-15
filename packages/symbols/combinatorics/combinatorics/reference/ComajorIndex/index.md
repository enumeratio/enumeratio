---
name: ComajorIndex
domain: Permutation statistics
signature: ComajorIndex(p)
summary: The sum of n - i over the descents i.
catalog:
  - system: findstat
    identity: St000833
    url: https://www.findstat.org/St000833
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: ComajorIndex(p)
    description: The sum of n - i over the descents i.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
- The major index of the reversed complement of p; not MinorIndex, which sums the ascent positions themselves.
