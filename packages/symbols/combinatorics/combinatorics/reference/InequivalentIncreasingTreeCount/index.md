---
name: InequivalentIncreasingTreeCount
domain: Tree statistics
signature: InequivalentIncreasingTreeCount(tree)
summary: "The number of increasing labelings of the tree up to its automorphisms: n! over the tree factorial and the automorphism group size."
signatures:
  - call: InequivalentIncreasingTreeCount(tree)
    description: "The number of increasing labelings of the tree up to its automorphisms: n! over the tree factorial and the automorphism group size."
    library: enumeratio-combinatorics
    type: (ordered_tree) -> number
---

- Defined over `OrderedTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `OrderedTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
