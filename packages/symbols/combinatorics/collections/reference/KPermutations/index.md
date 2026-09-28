---
name: KPermutations
domain: Collections
signature: KPermutations(n, k)
summary: 'The $k$-permutations of $\{1, \dots, n\}$: ordered selections of $k$ distinct elements, same family as [[Arrangements]].'
signatures:
  - call: KPermutations(n, k)
    description: the $n!/(n-k)!$ ordered $k$-element selections from $\{1, \dots, n\}$
    library: enumeratio-collections
    type: (integer<0..>, integer<0..>) -> indexed_collection<list<integer>>
seeAlso:
  - Arrangements
---
