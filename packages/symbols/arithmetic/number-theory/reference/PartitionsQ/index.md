---
name: PartitionsQ
domain: Number theory
signature: PartitionsQ(n)
summary: The number $q(n)$ of partitions of $n$ into distinct parts.
signatures:
  - call: PartitionsQ(n)
    description: $q(n)$, distinct-part partitions of $n$
    library: enumeratio-number-theory
    type: (integer) -> integer
seeAlso:
  - DistinctPartitions
  - IntegerPartitions
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sage
    template: Partitions($1, max_slope=-1).cardinality()
    arity: 1
    threadArgOnly: 1
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: mathlib4
    template: ((Nat.Partition.distincts $1).card)
    arity: 1
    note: "The partitions of n whose parts are all distinct (Nat.Partition.distincts), counted by enumerating them: exponential in n, so a large n runs into the per-item time cap."
---

- By Euler's theorem, $q(n)$ also counts the partitions of $n$ into odd parts — see [[IntegerPartitions]].
- Counts the [[DistinctPartitions]] family.
