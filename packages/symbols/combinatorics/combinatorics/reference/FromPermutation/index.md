---
name: FromPermutation
domain: Combinatorial maps
signature: FromPermutation(Permutation)
summary: "The increasing binary tree built by minimum-splitting recursion: the position of the smallest value roots the tree, everything before it recurses to the left, everything after it to the right."
mapOn:
  - Permutation
signatures:
  - call: FromPermutation(Permutation)
    description: "The increasing binary tree built by minimum-splitting recursion: the position of the smallest value roots the tree, everything before it recurses to the left, everything after it to the right."
    library: enumeratio-combinatorics
    type: (permutation) -> increasing_binary_tree
---

- Takes a `Permutation` and returns a `IncreasingBinaryTree` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- Paired with ToPermutation, whose overload set (IncreasingBinaryTree among others) names this map's codomain. The root is always 1: every permutation of [n] holds the value 1, and heap order puts the global minimum at the top regardless of which permutation it came from. Built by real recursion, the same [label, left, right] nesting IncreasingBinaryTrees' cartesianTree builds.
