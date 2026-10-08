---
name: Commonest
domain: Collections
signature: Commonest(collection)
summary: Every element tied for the most frequently occurring in the collection.
signatures:
  - call: Commonest(collection)
    description: every element tied for the highest frequency, in the order first encountered.
    library: enumeratio-combinatorics
    type: (indexed_collection<T>, integer?) -> list<T> where T
  - call: Commonest(collection, n)
    description: the $n$ commonest elements, ties broken by first appearance, listed in order of first appearance.
    library: enumeratio-combinatorics
seeAlso:
  - Mode
  - Mean
  - Median
names:
  wolframIdentity: true
---

- Wolfram's answer to a tied [[Mode]]: where Mode picks one, Commonest returns every value tied for the highest frequency.
- With a unique mode, $Commonest(c) = \{Mode(c)\}$: a single-element list.
- Every returned value occurs exactly as many times as the highest frequency in the collection. See [[Count]].
