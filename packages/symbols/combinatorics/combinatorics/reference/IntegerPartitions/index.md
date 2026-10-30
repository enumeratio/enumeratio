---
name: IntegerPartitions
domain: Collections
signature: IntegerPartitions(n)
summary: The partitions of $n$ into positive parts, as a lazy indexed family.
maxSize: 30
signatures:
  - call: IntegerPartitions(n)
    description: every way to write $n$ as a sum of positive parts, order-insensitive.
    library: enumeratio-combinatorics
    type: (integer, any?, any?) -> indexed_collection<integer_partition>
  - call: IntegerPartitions(n, k)
    description: the partitions of $n$ into at most $k$ parts.
    library: enumeratio-combinatorics
  - call: IntegerPartitions(n, {k})
    description: the partitions of $n$ into exactly $k$ parts.
    library: enumeratio-combinatorics
  - call: IntegerPartitions(n, All, parts)
    description: the partitions of $n$ using only parts drawn from the given list.
    library: enumeratio-combinatorics
enumerate:
  expr: IntegerPartitions(8)
  columns: PartCount, LargestPart, DistinctParts, DurfeeSquare
  glyph: partition
seeAlso:
  - Count
  - At
  - Length
  - IntegerCompositions
  - SetPartitions
references:
  - system: wikipedia
    identity: Integer partition
  - system: mathworld
    identity: Partition
  - system: oeis
    identity: A000041
names:
  wolframIdentity: true
catalog:
  - system: mathlib4
    identity: Nat.Partition
    url: https://leanprover-community.github.io/mathlib4_docs/Mathlib/Combinatorics/Enumerative/Partition/Basic.html
  - system: sage
    identity: Partitions(n)
    url: https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/partition.html
  - system: sympy
    identity: partitions
    url: https://docs.sympy.org/latest/modules/utilities/iterables.html#sympy.utilities.iterables.partitions
    note: "partitions(n) yields {part_size: multiplicity} dicts, not a parts list — expand + sort descending to compare"
  - system: wikipedia
    identity: Partition (number theory)
    url: https://en.wikipedia.org/wiki/Partition_(number_theory)
    relation: conceptual
  - system: wolfram
    identity: PartitionsP
    url: https://reference.wolfram.com/language/ref/PartitionsP.html
grades:
  - name: n
    role: axis
carrier: IntegerPartition
bindings:
  - origin: mapped
    form: combinatorica
    template: Partitions[$1]
    arity: 1
  - origin: mapped
    form: combinatorica
    template: If[IntegerQ[$2], Reverse[Sort[Map[TransposePartition, Partitions[$1, $2]], Function[{a, b}, OrderedQ[{PadRight[a, $1], PadRight[b, $1]}]]]], If[ListQ[$2] && 1 <= Length[$2] <= 3, Select[Partitions[$1], MemberQ[Switch[Length[$2], 1, $2, 2, Range[$2[[1]], Min[$2[[2]], $1]], 3, Range[$2[[1]], Min[$2[[2]], $1], $2[[3]]]], Length[#]] &], Missing["NotCombinatorica"]]]
    arity: 2
    note: Combinatorica's Partitions[n, k] bounds the LARGEST part by k; ours (and Wolfram's) bound the number of parts, so the template transposes each partition and restores descending lexicographic order. A list `{k}`, `{kmin, kmax}` or `{kmin, kmax, dk}` selects the partitions of `Partitions[n]` by their number of parts.
  - origin: mapped
    form: mathlib4
    template: "((((Finset.univ : Finset (Nat.Partition ($1 : ℕ)))).val.map (fun p => p.parts.sort (· ≥ ·))).sort (· ≥ ·))"
    arity: 1
    note: Nat.Partition n enumerated (Fintype), each partition's parts sorted largest first and the lot in reverse lexicographic order, as ours lists them; the one-argument form only
---

- A lazy indexed collection, unranked in reverse-lexicographic order; the count is the partition number $p(n)$ — $p(8) = 22$ — with no elementary closed form.
- Each element is the part list in weakly decreasing order; drawn as a Ferrers diagram, its statistics (Length, LargestPart, DurfeeSquare, …) live in $@enumeratio/statistics$.
- Conjugation (transposing the diagram) is an involution; the self-conjugate partitions of $n$ equal the partitions of $n$ into distinct odd parts.
