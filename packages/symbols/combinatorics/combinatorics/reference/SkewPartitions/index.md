---
name: SkewPartitions
domain: Collections
signature: SkewPartitions(size)
summary: Reduced skew shapes $\lambda/\mu$ with $n$ cells — no empty row or column — as a lazy indexed family.
signatures:
  - call: SkewPartitions(size)
    library: enumeratio-combinatorics
    description: the reduced skew shapes $\lambda/\mu$ with `size` cells total ($|\lambda| - |\mu| = n$).
    type: (integer<0..>) -> indexed_collection<list<list<integer>>>
enumerate:
  expr: SkewPartitions(4)
seeAlso:
  - IntegerPartitions
  - Count
  - At
catalog:
  - system: sage
    identity: SkewPartitions(n)
    url: https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/skew_partition.html
grades:
  - name: size
    role: axis
carrier: SkewPartition
---

- A lazy indexed collection with no closed form, following Sage's `SkewPartitions(n)`: the count is a table over the last row of a shape and the cells left (exact, until it passes $2^{53}$ at $n = 34$, where the count is unknown), and a place in the order is found by walking that table, so `At` is quick at sizes whose whole list is far too long.
- Each element packs both partitions as `[λ, μ]`; "reduced" means every row of $\lambda$ strictly exceeds the matching row of $\mu$ (no empty row) and every column $1..\lambda_1$ is covered by some row's cells (no empty column). $\mu$ has no zero parts: `[[2, 1], [1, 0]]` is not an element, `[[2, 1], [1]]` is.
- Unranked lexicographically, by $\lambda$ first, then by $\mu$.
