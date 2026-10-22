---
name: LongestPathVertexCount
domain: Tree statistics
signature: LongestPathVertexCount(tree)
summary: "The most vertices on a path from the root: the height plus one."
signatures:
  - call: LongestPathVertexCount(tree)
    description: "The most vertices on a path from the root: the height plus one."
    library: enumeratio-combinatorics
    type: (ordered_tree) -> number
---

- Defined over `OrderedTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `OrderedTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- FindStat calls this the depth of an ordered tree.
