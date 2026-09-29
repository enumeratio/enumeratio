---
name: OddSubsets
domain: Collections
signature: OddSubsets(n)
summary: 'The subsets of $\{1, \dots, n\}$ of odd size: the other half of [[Subsets]], $2^{n-1}$ of them for $n \ge 1$.'
signatures:
  - call: OddSubsets(n)
    description: the odd-size subsets of $\{1, \dots, n\}$
    library: enumeratio-combinatorics
    type: (integer<0..>) -> indexed_collection<list<integer>>
seeAlso:
  - Subsets
  - EvenSubsets
---
