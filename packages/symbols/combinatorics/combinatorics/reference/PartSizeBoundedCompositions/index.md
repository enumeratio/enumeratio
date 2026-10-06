---
name: PartSizeBoundedCompositions
domain: Collections
signature: PartSizeBoundedCompositions(n, k)
summary: The compositions of $n$ into parts of size at most $k$.
signatures:
  - call: PartSizeBoundedCompositions(n, k)
    description: the compositions of $n$ into parts of size at most $k$
    library: enumeratio-combinatorics
    type: (integer<0..>, integer<0..>) -> indexed_collection<composition>
seeAlso:
  - PartCountBoundedCompositions
  - IntegerCompositions
  - FibonacciCompositions
  - TriCompositions
  - TetraCompositions
catalog:
  - system: sage
    identity: Compositions(n, max_part=k)
    url: https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/composition.html
    note: "max_part=k; verified n=1..6 for k=2 (1, 2, 3, 5, 8, 13) and k=3 (1, 2, 4, 7, 13, 24). max_length=k bounds the part count instead: see PartCountBoundedCompositions"
grades:
  - name: n
    role: axis
  - name: k
    role: axis
carrier: Composition
---

- Bounds the size of each part; to bound how many parts there are, see [[PartCountBoundedCompositions]].
- Count is the generalized $k$-nacci sequence; specializes to [[FibonacciCompositions]] at $k=2$, [[TriCompositions]] at $k=3$, [[TetraCompositions]] at $k=4$.
