---
name: SortBy
domain: Collections
signature: SortBy(collection, f)
summary: The collection sorted by the value of a function on each element.
signatures:
  - call: SortBy(collection, f)
    description: sorted by $f(element)$, ascending, stable on ties.
    library: enumeratio-combinatorics
    type: (collection<T>, (T) any -> any) -> collection<T> where T
seeAlso:
  - Sort
  - GatherBy
names:
  wolframIdentity: true
---
