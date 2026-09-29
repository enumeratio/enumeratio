---
name: ToLehmerCode
domain: Combinatorial maps
signature: ToLehmerCode(Permutation)
summary: Entry i counts the later entries smaller than p(i).
references:
  - system: wikipedia
    identity: Lehmer code
  - system: rosettacode
    identity: Permutations/Rank of a permutation
mapOn:
  - Permutation
signatures:
  - call: ToLehmerCode(Permutation)
    description: Entry i counts the later entries smaller than p(i).
    library: enumeratio-combinatorics
    type: (permutation) -> subexcedant_seq
---

- Takes a `Permutation` and returns a `SubexcedantSeq` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- Its total is the inversion count, which is the Lehmer code's whole point.
