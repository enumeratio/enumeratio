---
name: PartitionsIntoKParts
domain: Collections
signature: PartitionsIntoKParts(n, k)
summary: The integer partitions of $n$ into exactly $k$ positive parts.
signatures:
  - call: PartitionsIntoKParts(n, k)
    description: partitions of $n$ with exactly $k$ parts
    library: enumeratio-combinatorics
    type: (integer<0..>, integer<0..>) -> indexed_collection<integer_partition>
seeAlso:
  - IntegerPartitions
  - PartitionsInBox
---
