---
name: IntegerModRing
domain: Modular arithmetic
signature: IntegerModRing(m)
summary: "The old spelling of [[QuotientRing]]`(Integers, m)`, kept working: `IntegerModRing(m)` evaluates to its canonical form."
signatures:
  - call: IntegerModRing(m)
    description: same as QuotientRing(Integers, m)
    library: enumeratio-residues
    type: (integer) -> set
seeAlso:
  - QuotientRing
---
