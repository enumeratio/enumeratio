---
name: SubsetsWithoutConsecutive
domain: Collections
signature: SubsetsWithoutConsecutive(n)
summary: The subsets of $\{1, \dots, n\}$ containing no two consecutive integers. Count is the Fibonacci number $F(n+2)$.
signatures:
  - call: SubsetsWithoutConsecutive(n)
    description: subsets of $\{1, \dots, n\}$ with no two consecutive elements
    library: enumeratio-combinatorics
    type: (integer<0..>) -> indexed_collection<list<integer>>
seeAlso:
  - Subsets
  - FibonacciWords
---
