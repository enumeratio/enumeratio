---
name: TriangularCompositions
domain: Collections
signature: TriangularCompositions(n)
summary: The compositions of $n$ into triangular-number parts.
signatures:
  - call: TriangularCompositions(n)
    description: the compositions of $n$ into triangular-number parts
    library: enumeratio-collections
    type: (integer<0..>) -> indexed_collection<composition>
seeAlso:
  - IntegerCompositions
references:
  - system: oeis
    identity: A023361
catalog:
  - system: oeis
    identity: A023361
    url: https://oeis.org/A023361
grades:
  - name: n
    role: axis
carrier: Composition
---

- Count is A023361.
