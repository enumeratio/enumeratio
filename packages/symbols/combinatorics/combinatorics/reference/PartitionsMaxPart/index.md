---
name: PartitionsMaxPart
domain: Collections
signature: PartitionsMaxPart(n, m)
summary: The integer partitions of $n$ with every part at most $m$.
signatures:
  - call: PartitionsMaxPart(n, m)
    description: partitions of $n$ with every part $\le m$
    library: enumeratio-combinatorics
    type: (integer<0..>, integer<0..>) -> indexed_collection<integer_partition>
seeAlso:
  - IntegerPartitions
  - PartitionsInBox
bindings:
  - origin: mapped
    form: mathlib4
    template: "((((Finset.univ : Finset (Nat.Partition ($1 : ℕ))).filter (fun p => ∀ x ∈ p.parts, x ≤ ($2 : ℕ))).val.map (fun p => p.parts.sort (· ≥ ·))).sort (· ≥ ·))"
    arity: 2
    note: Nat.Partition n enumerated, those with every part at most m, ordered as IntegerPartitions
---
