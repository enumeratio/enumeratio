---
name: SplitBy
domain: Collections
signature: SplitBy(list, f)
summary: Split a list into runs on which a function is constant.
signatures:
  - call: SplitBy(list, f)
    description: runs on which $f(element)$ stays the same.
    library: enumeratio-collections
    type: (indexed_collection<T>, (T) any -> any) -> list<list<T>> where T
seeAlso:
  - Split
  - GatherBy
names:
  wolframIdentity: true
---

- [[Split]] with the adjacency test "same $f$ value" instead of plain equality.
