---
name: PermutationMin
domain: Permutation statistics
signature: PermutationMin(p)
summary: The smallest point $p$ moves; infinity for the identity.
statOn:
  - Permutation
signatures:
  - call: PermutationMin(p)
    description: The smallest point $p$ moves; infinity for the identity.
    library: enumeratio-combinatorics
    type: (permutation) -> number
names:
  wolframIdentity: true
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Wolfram's `Cycles` input is not read here: wrap a one-line word in `Permutation`, or turn `Cycles` into one with [[PermutationList]] first
- Leading fixed points do not count: `{1, 3, 2}` has minimum 2
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
