---
name: DyckPathOf
domain: Combinatorial maps
signature: DyckPathOf(BinaryTree)
summary: A binary tree [L, R] as the Dyck path U φ(L) D φ(R).
catalog:
  - system: findstat
    identity: Mp00012
    url: https://www.findstat.org/Mp00012
    on: BinaryTree
signatures:
  - call: DyckPathOf(BinaryTree)
    description: A binary tree [L, R] as the Dyck path U φ(L) D φ(R).
    library: enumeratio-domains
    type: (binary_tree) -> dyck_path
---

- Takes a `BinaryTree` and returns a `DyckPath` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00012. An order isomorphism: BinaryTrees is ranked through it, so the k-th tree goes to the k-th Dyck path.
