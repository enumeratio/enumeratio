---
name: TetraCompositions
domain: Collections
signature: TetraCompositions(n)
summary: The compositions of $n$ into parts from $\{1, 2, 3, 4\}$.
signatures:
  - call: TetraCompositions(n)
    description: the compositions of $n$ into parts from $\{1, 2, 3, 4\}$
    library: enumeratio-combinatorics
    type: (integer<0..>) -> indexed_collection<composition>
seeAlso:
  - IntegerCompositions
  - TriCompositions
  - PartSizeBoundedCompositions
references:
  - system: oeis
    identity: A000078
catalog:
  - system: oeis
    identity: A000078
    url: https://oeis.org/A000078
    note: "tetranacci: compositions into {1,2,3,4}"
grades:
  - name: n
    role: axis
carrier: Composition
---

- Count is the tetranacci number (A000078).
