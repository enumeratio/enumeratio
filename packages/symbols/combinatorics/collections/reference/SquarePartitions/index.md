---
name: SquarePartitions
domain: Collections
signature: SquarePartitions(n)
summary: The partitions of $n$ into perfect-square parts.
signatures:
  - call: SquarePartitions(n)
    description: the partitions of $n$ into perfect-square parts
    library: enumeratio-collections
    type: (integer<0..>) -> indexed_collection<integer_partition>
seeAlso:
  - IntegerPartitions
references:
  - system: oeis
    identity: A001156
catalog:
  - system: oeis
    identity: A001156
    url: https://oeis.org/A001156
grades:
  - name: n
    role: axis
carrier: IntegerPartition
---

- Count is A001156.
