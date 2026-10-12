---
name: PlanePartitions
domain: Collections
signature: PlanePartitions(size)
summary: Plane partitions of $n$ — 2D arrays of positive integers nonincreasing along rows and down columns, summing to $n$ — as a lazy indexed family.
signatures:
  - call: PlanePartitions(size)
    library: enumeratio-combinatorics
    description: the plane partitions summing to `size` (OEIS A000219).
    type: (integer<0..>) -> indexed_collection<list<list<integer>>>
enumerate:
  expr: PlanePartitions(6)
  columns: Length
seeAlso:
  - IntegerPartitions
  - Count
  - At
catalog:
  - system: oeis
    identity: A000219
    url: https://oeis.org/A000219
  - system: sage
    identity: PlanePartitions(n)
    url: https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/plane_partition.html
grades:
  - name: size
    role: axis
carrier: PlanePartition
---

- A lazy indexed collection with no known simple closed form, unlike ordinary partitions' generating function; the count comes from MacMahon's product $\prod_k (1 - x^k)^{-k}$ — $Count(PlanePartitions(6)) = 48$.
- Each element is the array's rows; entries weakly decrease along every row and down every column, and the whole array sums to $n$.
- Unranked in shape-then-entries order: by row-length shape first, then the flattened array.
- Stays TS. A rank is found by walking a table of counts by shape (the layers of a plane partition are nested shapes), then enumerating the one shape it lands in, so `At` answers up to about $n = 33$, far past what the whole list could be built. A table over rows and sums would be far larger than the list ([[BoxedPlanePartitions]] has one, since a box bounds the rows).
