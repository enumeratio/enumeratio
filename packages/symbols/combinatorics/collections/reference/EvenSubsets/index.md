---
name: EvenSubsets
domain: Collections
signature: EvenSubsets(n)
summary: 'The subsets of $\{1, \dots, n\}$ of even size: half of [[Subsets]], $2^{n-1}$ of them for $n \ge 1$.'
signatures:
  - call: EvenSubsets(n)
    description: the even-size subsets of $\{1, \dots, n\}$
    library: enumeratio-collections
    type: (integer<0..>) -> indexed_collection<list<integer>>
seeAlso:
  - Subsets
  - OddSubsets
---
