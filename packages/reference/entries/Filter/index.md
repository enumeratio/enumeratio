---
name: Filter
domain: Compute engine
signature: "Filter(collection<T>, predicate: (T) any -> boolean) -> collection where T"
summary: Return the elements of the collection for which the predicate function returns True. Equivalent to `[x for x in xs if p(x)]`.
signatures:
  - call: "Filter(collection<T>, predicate: (T) any -> boolean) -> collection where T"
    description: as compute-engine declares it
  - call: Filter(predicate)
    description: the operator form, $\mathrm{Filter}(p)(xs) = \mathrm{Filter}(xs, p)$.
    library: enumeratio-combinatorics
    type: (any) -> any
    overrides: compute-engine
names:
  wolfram: Select
stub: engine
attributes:
  - HoldAll
---
