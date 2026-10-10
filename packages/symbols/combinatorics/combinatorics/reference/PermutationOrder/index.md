---
name: PermutationOrder
domain: Permutation statistics
signature: PermutationOrder(p)
summary: The order of p in the symmetric group — the lcm of its cycle lengths.
formerly:
  - Order
statOn:
  - Permutation
signatures:
  - call: PermutationOrder(p)
    description: The order of p in the symmetric group — the lcm of its cycle lengths.
    library: enumeratio-combinatorics
    type: (permutation) -> number
names:
  wolframIdentity: true
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Wolfram's PermutationOrder. The bare `Order` is Wolfram's canonical-ordering comparison `Order[a, b]`, so it survives only as a data alias.
