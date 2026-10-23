---
name: TransposeComposition
domain: Combinatorial maps
signature: TransposeComposition(Composition)
summary: "The conjugate composition: its ribbon shape transposed, the complement of the reverse."
seeAlso:
  - Complement
  - Reverse
catalog:
  - system: findstat
    identity: Mp00041
    url: https://www.findstat.org/Mp00041
    on: Composition
mapOn:
  - Composition
laws:
  - involution
  - graded:
      from: IntegerCompositions
      to: IntegerCompositions
    on: composition
signatures:
  - call: TransposeComposition(Composition)
    description: "The conjugate composition: its ribbon shape transposed, the complement of the reverse."
    library: enumeratio-combinatorics
    type: (composition) -> composition
---

- Takes a `Composition` and returns a `Composition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- Defined as a COMPOSITION, applied right to left: [[Complement]] after [[Reverse]]. Each step goes through its own declared head, so every intermediate value is a properly constructed carrier.
- FindStat's "conjugate" on compositions, named for TransposePartition and TransposeTableau: Conjugate is already the complex conjugate. hopf's ConjugateComposition is the same operation on a plain list of parts.
