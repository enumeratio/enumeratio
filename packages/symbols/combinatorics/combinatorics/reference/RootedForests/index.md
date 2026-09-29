---
name: RootedForests
domain: Collections
signature: RootedForests(n)
summary: The forests of rooted labeled trees on $\{1, \dots, n\}$, each element a length-$n$ parent array (entry $0$ marks a root). Count $(n+1)^{n-1}$.
signatures:
  - call: RootedForests(n)
    description: the rooted forests on $\{1, \dots, n\}$, as parent arrays
    library: enumeratio-combinatorics
    type: (integer<0..>) -> indexed_collection<list<integer>>
---
