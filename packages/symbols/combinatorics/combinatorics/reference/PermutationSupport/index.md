---
name: PermutationSupport
domain: Permutation statistics
signature: PermutationSupport(p)
summary: The points $p$ moves, in increasing order.
statOn:
  - Permutation
signatures:
  - call: PermutationSupport(p)
    description: The points $p$ moves, in increasing order.
    library: enumeratio-combinatorics
    type: (permutation) -> list<integer>
names:
  wolframIdentity: true
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Wolfram's `Cycles` input is not read here: wrap a one-line word in `Permutation`, or turn `Cycles` into one with [[PermutationList]] first
- The identity has an empty support; the support's size is [[PermutationLength]]
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
