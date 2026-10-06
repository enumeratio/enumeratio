---
name: PartCountBoundedCompositions
domain: Collections
signature: PartCountBoundedCompositions(n, k)
summary: The compositions of $n$ into at most $k$ parts.
signatures:
  - call: PartCountBoundedCompositions(n, k)
    description: the compositions of $n$ into at most $k$ parts, each part a positive integer
    library: enumeratio-combinatorics
    type: (integer<0..>, integer<0..>) -> indexed_collection<composition>
seeAlso:
  - PartSizeBoundedCompositions
  - CompositionsIntoKParts
  - IntegerCompositions
catalog:
  - system: sage
    identity: Compositions(n, max_length=k)
    url: https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/composition.html
    note: "max_length=k; verified n=1..6 for k=2 (1, 2, 3, 4, 5, 6) and k=3 (1, 2, 4, 7, 11, 16). max_part=k bounds the part size instead: see PartSizeBoundedCompositions"
  - system: oeis
    identity: A000027
    url: https://oeis.org/A000027
    note: k=2, n≥1; k=3 is A000124 shifted (n-1), the lazy caterer's sequence
grades:
  - name: n
    role: axis
  - name: k
    role: axis
carrier: Composition
---

- Bounds how many parts there are; to bound the size of each part, see [[PartSizeBoundedCompositions]]. Exactly $k$ parts is [[CompositionsIntoKParts]].
- Count is $\sum_{j \le k} \binom{n-1}{j-1}$ for $n \ge 1$ (and $1$ at $n = 0$, the empty composition): the cumulative binomial row, $2^{n-1}$ once $k \ge n$.
- Elements come in lexicographic order on the parts.
