---
name: AutomorphismGroupSize
domain: Tree statistics
signature: AutomorphismGroupSize(tree)
summary: "The number of ways to permute identical children, at every vertex at once: the product, over the vertices, of the factorials of how many times each child tree occurs."
signatures:
  - call: AutomorphismGroupSize(tree)
    description: "The number of ways to permute identical children, at every vertex at once: the product, over the vertices, of the factorials of how many times each child tree occurs."
    library: enumeratio-combinatorics
    type: (ordered_tree) -> number
---

- Defined over `OrderedTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `OrderedTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
