---
name: Tuples
domain: Combinatorial collections
signature: Tuples(n, k)
summary: 'The k-tuples over $\{1, \dots, n\}$: all $n^k$ ordered selections with repetition.'
signatures:
  - call: Tuples(n, k)
    description: the $n^k$ length-$k$ tuples
    library: enumeratio-combinatorics
    type: ((integer<0..>, integer<0..>) -> indexed_collection<list<integer>>) & ((list<any>, integer<0..>) -> list<list<any>>)
  - call: Tuples(list, k)
    description: the $\lvert list \rvert^k$ length-$k$ tuples of the list's own elements, as a $List$ (up to a size cap)
    library: enumeratio-combinatorics
seeAlso:
  - Subsets
  - Multisets
references:
  - system: wikipedia
    identity: Tuple
  - system: mathworld
    identity: n-Tuple
names:
  wolframIdentity: true
---

- Count is $n^k$
- Elements are ordered as mixed-radix (base $n$) counting
