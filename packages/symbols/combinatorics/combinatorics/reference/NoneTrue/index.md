---
name: NoneTrue
domain: Collections
signature: NoneTrue(xs, predicate)
summary: Whether no element of a collection satisfies a predicate.
signatures:
  - call: NoneTrue(xs, predicate)
    description: $True$ if $predicate$ holds for no element of $xs$, else $False$.
    library: enumeratio-combinatorics
    type: (indexed_collection<T>, (T) any -> boolean) -> boolean where T
seeAlso:
  - All
  - Any
names:
  wolframIdentity: true
---

- The negation of [[Any]]: $NoneTrue(xs, p) = Not(Any(xs, p))$.
