---
name: LatticePaths
domain: Collections
signature: LatticePaths(a, b)
summary: The monotone lattice paths from $(0,0)$ to $(a,b)$ using unit north/east steps, each written as a $0/1$ step sequence ($1$ = north). Count $\binom{a+b}{a}$.
signatures:
  - call: LatticePaths(a, b)
    description: the monotone north/east lattice paths in an $a \times b$ grid
    library: enumeratio-combinatorics
    type: (integer<0..>, integer<0..>) -> indexed_collection<list<integer>>
seeAlso:
  - PartitionsInBox
---
