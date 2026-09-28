---
name: BinaryStrings
domain: Collections
signature: BinaryStrings(n)
summary: The $2^n$ binary strings of length $n$, in standard binary counting order.
signatures:
  - call: BinaryStrings(n)
    description: the binary strings of length $n$
    library: enumeratio-collections
    type: (integer<0..>) -> indexed_collection<list<integer>>
seeAlso:
  - BinaryWords
---
