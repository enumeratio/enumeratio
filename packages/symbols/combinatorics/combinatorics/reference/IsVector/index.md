---
name: IsVector
domain: Collections
signature: IsVector(list) / IsVector(list, test)
summary: Tests whether list is a rank-1 List, optionally with every element satisfying test.
signatures:
  - call: IsVector(list)
    description: True if list is a List none of whose elements is itself a List
    library: enumeratio-combinatorics
    type: (any, function?) -> boolean
  - call: IsVector(list, test)
    description: as above, and test holds of every element
    library: enumeratio-combinatorics
seeAlso:
  - IsMatrix
  - IsArray
names:
  wolfram: VectorQ
---

- A List containing a List (even a ragged one) is a matrix shape, not a vector — False.
- A lazy ordered collection such as $Range(1, 10)$ stands for the List it evaluates to.
- test is applied via Apply, same calling convention as a Function literal passed to Select/Map.
