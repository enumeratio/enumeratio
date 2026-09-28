---
name: PartitionsMaxPart
domain: Collections
signature: PartitionsMaxPart(n, m)
summary: The integer partitions of $n$ with every part at most $m$.
signatures:
  - call: PartitionsMaxPart(n, m)
    description: partitions of $n$ with every part $\le m$
    library: enumeratio-collections
    type: (integer<0..>, integer<0..>) -> indexed_collection<list<integer>>
seeAlso:
  - IntegerPartitions
  - PartitionsInBox
---
