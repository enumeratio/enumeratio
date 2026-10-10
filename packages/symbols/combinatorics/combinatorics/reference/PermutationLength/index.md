---
name: PermutationLength
domain: Permutation statistics
signature: PermutationLength(p)
summary: The number of points $p$ moves.
statOn:
  - Permutation
signatures:
  - call: PermutationLength(p)
    description: The number of points $p$ moves.
    library: enumeratio-combinatorics
    type: (permutation) -> number
names:
  wolframIdentity: true
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Wolfram's `Cycles` input is not read here: wrap a one-line word in `Permutation`, or turn `Cycles` into one with [[PermutationList]] first
- The identity moves nothing, so its length is 0; a $k$-cycle has length $k$ (fixed points do not count)
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
