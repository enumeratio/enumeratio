---
name: BoundaryLengthBeyondTrunk
domain: Tree statistics
signature: BoundaryLengthBeyondTrunk(tree)
summary: The edges on the leftmost path or the rightmost path from the root, less the trunk they share.
signatures:
  - call: BoundaryLengthBeyondTrunk(tree)
    description: The edges on the leftmost path or the rightmost path from the root, less the trunk they share.
    library: enumeratio-combinatorics
    type: (ordered_tree) -> number
---

- Defined over `OrderedTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `OrderedTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
