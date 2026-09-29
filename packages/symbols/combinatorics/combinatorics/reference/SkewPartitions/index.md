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

- A lazy indexed collection with no known closed form; the count is the cached enumeration's length, following Sage's `SkewPartitions(n)` convention.
- Each element packs both partitions as `[λ, μ]`; "reduced" means every row of $\lambda$ strictly exceeds the matching row of $\mu$ (no empty row) and every column $1..\lambda_1$ is covered by some row's cells (no empty column).
- Unranked lexicographically, by $\lambda$ first, then by $\mu$.
