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
bindings:
  - origin: mapped
    form: mathlib4
    template: "((((Finset.univ : Finset (Nat.Partition ($1 : ℕ))).filter (fun p => p.parts.card = ($2 : ℕ))).val.map (fun p => p.parts.sort (· ≥ ·))).sort (· ≥ ·))"
    arity: 2
    note: Nat.Partition n enumerated, those with exactly k parts, ordered as IntegerPartitions
---
