---
name: HookNumber
domain: Tree statistics
signature: HookNumber(tree)
summary: "The number of hooks in the decomposition of the tree into hooks: a node with the chains of left children and of right children below it, the subtrees hanging off those chains decomposed in turn."
signatures:
  - call: HookNumber(tree)
    description: "The number of hooks in the decomposition of the tree into hooks: a node with the chains of left children and of right children below it, the subtrees hanging off those chains decomposed in turn."
    library: enumeratio-combinatorics
    type: (binary_tree) -> number
---

- Defined over `BinaryTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `BinaryTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
