---
name: StrahlerNumber
domain: Tree statistics
signature: StrahlerNumber(tree)
summary: "BinaryTree: The Horton-Strahler number (register function): 0 for the empty tree, else the larger child's, plus one if the children tie. OrderedTree: The Strahler number: a leaf is 1, a vertex takes its largest child's, plus one if that value occurs twice."
catalog:
  - system: findstat
    identity: St000396
    url: https://www.findstat.org/St000396
    on: BinaryTree
  - system: findstat
    identity: St000397
    url: https://www.findstat.org/St000397
    on: OrderedTree
statOn:
  - BinaryTree
  - OrderedTree
signatures:
  - call: StrahlerNumber(tree)
    description: "BinaryTree: The Horton-Strahler number (register function): 0 for the empty tree, else the larger child's, plus one if the children tie. OrderedTree: The Strahler number: a leaf is 1, a vertex takes its largest child's, plus one if that value occurs twice."
    library: enumeratio-combinatorics
    type: (binary_tree | ordered_tree) -> number
---

- Defined over `BinaryTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `BinaryTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Defined over `OrderedTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `OrderedTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
