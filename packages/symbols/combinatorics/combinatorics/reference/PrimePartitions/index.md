---
name: PrimePartitions
domain: Collections
signature: PrimePartitions(n)
summary: The partitions of $n$ into prime parts.
signatures:
  - call: PrimePartitions(n)
    description: the partitions of $n$ into prime parts
    library: enumeratio-combinatorics
    type: (integer<0..>) -> indexed_collection<integer_partition>
seeAlso:
  - IntegerPartitions
references:
  - system: oeis
    identity: A000607
catalog:
  - system: oeis
    identity: A000607
    url: https://oeis.org/A000607
grades:
  - name: n
    role: axis
carrier: IntegerPartition
---

- Count is A000607.
