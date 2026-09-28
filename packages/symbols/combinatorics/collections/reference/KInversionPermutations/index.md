---
name: KInversionPermutations
domain: Collections
signature: KInversionPermutations(n, k)
summary: Permutations of $\{1, …, n\}$ with exactly $k$ inversions — row $n$ of the Mahonian triangle.
signatures:
  - call: KInversionPermutations(n, k)
    description: Permutations of $\{1, …, n\}$ with exactly $k$ inversions — row $n$ of the Mahonian triangle
    library: enumeratio-collections
    type: (integer<0..>, integer<0..>) -> indexed_collection<list<integer>>
details:
  - Count is the coefficient of $q^k$ in the $q$-factorial $[n]_q!$ (A008302).
seeAlso:
  - SymmetricGroup
  - Inversions
  - KDescentPermutations
references:
  - system: oeis
    identity: A008302
catalog:
  - system: oeis
    identity: A008302
    url: https://oeis.org/A008302
grades:
  - name: n
    role: axis
  - name: k
    role: axis
carrier: Permutation
---
