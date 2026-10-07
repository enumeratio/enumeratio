---
name: All
domain: Collections
signature: All(xs, predicate)
summary: Whether every element of a collection satisfies a predicate.
signatures:
  - call: All(xs, predicate)
    description: $True$ if $predicate$ holds for every element of $xs$, else $False$.
  - call: All(xs, predicate, level)
    description: the elements at exactly `level` tested instead of the top-level ones.
    library: enumeratio-combinatorics
    type: "(collection<T>, predicate: ((T) any -> boolean)?) -> boolean where T"
    overrides: compute-engine
seeAlso:
  - Any
  - NoneTrue
names:
  wolfram: AllTrue
attributes:
  - HoldAll
---
