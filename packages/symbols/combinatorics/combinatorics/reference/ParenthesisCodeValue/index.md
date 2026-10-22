---
name: ParenthesisCodeValue
domain: Tree statistics
signature: ParenthesisCodeValue(tree)
summary: "The value, read in binary, of the tree's parenthesis word: each node is ( left ) right, with ( as 1 and ) as 0."
signatures:
  - call: ParenthesisCodeValue(tree)
    description: "The value, read in binary, of the tree's parenthesis word: each node is ( left ) right, with ( as 1 and ) as 0."
    library: enumeratio-combinatorics
    type: (binary_tree) -> number
---

- Defined over `BinaryTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `BinaryTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- The word of a tree with n nodes has 2n digits; the empty tree's is empty, worth 0.
