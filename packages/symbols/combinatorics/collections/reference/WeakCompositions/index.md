---
name: WeakCompositions
domain: Collections
signature: WeakCompositions(n, k)
summary: "The weak compositions of $n$ into $k$ parts: ordered sequences of $k$ non-negative integers summing to $n$, unlike [[IntegerCompositions]] where every part must be positive."
signatures:
  - call: WeakCompositions(n, k)
    description: the $\binom{n+k-1}{k-1}$ sequences of $k$ non-negative parts summing to $n$
    library: enumeratio-collections
    type: (integer<0..>, integer<0..>) -> indexed_collection<list<integer>>
seeAlso:
  - IntegerCompositions
---
