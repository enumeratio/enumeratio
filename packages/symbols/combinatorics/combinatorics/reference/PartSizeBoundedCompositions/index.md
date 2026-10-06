---
name: KBoundedCompositions
domain: Collections
signature: KBoundedCompositions(n, k)
summary: The compositions of $n$ into parts from $\{1, …, k\}$.
signatures:
  - call: KBoundedCompositions(n, k)
    description: the compositions of $n$ into parts from $\{1, …, k\}$
    library: enumeratio-combinatorics
    type: (integer<0..>, integer<0..>) -> indexed_collection<composition>
seeAlso:
  - IntegerCompositions
  - FibonacciCompositions
  - TriCompositions
  - TetraCompositions
catalog:
  - system: sage
    identity: Compositions(n, max_length=k)
    url: https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/composition.html
grades:
  - name: n
    role: axis
  - name: max_parts
    role: axis
carrier: Composition
---

- Count is the generalized $k$-nacci sequence; specializes to [[FibonacciCompositions]] at $k=2$, [[TriCompositions]] at $k=3$, [[TetraCompositions]] at $k=4$.
