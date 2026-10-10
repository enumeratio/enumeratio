---
name: BoxedPlanePartitions
domain: Collections
signature: BoxedPlanePartitions(a, b, c)
summary: Plane partitions of any size fitting in an $a \times b \times c$ box — at most $a$ rows, each at most $b$ long, entries at most $c$ — as a lazy indexed family.
signatures:
  - call: BoxedPlanePartitions(a, b, c)
    library: enumeratio-combinatorics
    description: the plane partitions fitting an $a \times b \times c$ box.
    type: (integer<0..>, integer<0..>, integer<0..>) -> indexed_collection<list<list<integer>>>
enumerate:
  expr: BoxedPlanePartitions(2, 2, 2)
seeAlso:
  - PlanePartitions
  - Count
  - At
catalog:
  - system: sage
    identity: PlanePartitions([a, b, c])
    url: https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/plane_partition.html
    note: plane partitions fitting an a×b×c box; sage's PlanePartitions([a,b,c]) is the same box-confined set (our carrier stores the (a,b,c) bound)
grades:
  - name: a
    role: axis
  - name: b
    role: axis
  - name: c
    role: axis
carrier: PlanePartition
---

- A lazy indexed collection, exact and closed-form by MacMahon's box formula: $Count(BoxedPlanePartitions(a,b,c)) = \prod_{i=1}^{a} \prod_{j=1}^{b} \prod_{k=1}^{c} \frac{i+j+k-1}{i+j+k-2}$ — $Count(BoxedPlanePartitions(2,2,2)) = 20$.
- Each element is the array's rows, [[PlanePartitions]]'s ragged carrier: entries weakly decrease along every row and down every column, with trailing zeros trimmed rather than stored.
- Unranked in shape-then-entries order, same as [[PlanePartitions]]. A rank is found by walking a table over the rows a box allows (counting what each row starts), so `At` answers in boxes whose whole list is far too long to build, up to about $(5, 5, 5)$ (267,227,532 partitions); past that a call is refused as too long, and past $2^{53}$ partitions only the count answers.
