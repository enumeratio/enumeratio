---
name: OddPartitions
domain: Collections
signature: OddPartitions(n)
summary: The partitions of $n$ into odd parts.
signatures:
  - call: OddPartitions(n)
    description: the partitions of $n$ into odd parts
    library: enumeratio-combinatorics
    type: (integer<0..>) -> indexed_collection<integer_partition>
seeAlso:
  - IntegerPartitions
references:
  - system: oeis
    identity: A000009
catalog:
  - system: oeis
    identity: A000009
    url: https://oeis.org/A000009
grades:
  - name: n
    role: axis
carrier: IntegerPartition
bindings:
  - origin: mapped
    form: mathlib4
    template: "(((Nat.Partition.odds ($1 : ℕ)).val.map (fun p => p.parts.sort (· ≥ ·))).sort (· ≥ ·))"
    arity: 1
    note: Nat.Partition.odds, enumerated and ordered as IntegerPartitions
---

- Count is A000009; by Euler's theorem, equal to the count of partitions into distinct parts.
