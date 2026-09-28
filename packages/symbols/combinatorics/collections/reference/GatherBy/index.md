---
name: GatherBy
domain: Collections
signature: GatherBy(list, f)
summary: Group elements by the value of a function, in order of first appearance.
signatures:
  - call: GatherBy(list, f)
    description: elements grouped by $f(element)$, in first-appearance order.
    library: enumeratio-collections
    type: (indexed_collection<T>, (T) any -> any) -> list<list<T>> where T
details:
  - '[[Gather]] with the equivalence "same $f$ value" instead of plain equality.'
seeAlso:
  - Gather
  - SplitBy
  - SortBy
names:
  wolframIdentity: true
---
