---
name: PrefixSumProduct
domain: Permutation statistics
signature: PrefixSumProduct(p)
summary: The product of the prefix sums p(1) + ... + p(i) for i < n.
catalog:
  - system: findstat
    identity: St001482
    url: https://www.findstat.org/St001482
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: PrefixSumProduct(p)
    description: The product of the prefix sums p(1) + ... + p(i) for i < n.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
