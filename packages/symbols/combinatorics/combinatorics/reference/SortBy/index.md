---
name: SortBy
domain: Collections
signature: SortBy(collection, f)
summary: The collection sorted by the value of a function on each element.
signatures:
  - call: SortBy(collection, f)
    description: sorted by $f(element)$, ascending; elements with equal keys come out in canonical order. `SortBy(c, [f])`, with the key function in a list, is stable, keeping input order on ties.
    library: enumeratio-combinatorics
    type: (collection<T>, any) -> collection<T> where T
seeAlso:
  - Sort
  - GatherBy
names:
  wolframIdentity: true
---
