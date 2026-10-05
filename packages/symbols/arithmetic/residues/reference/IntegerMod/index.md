---
name: IntegerMod
domain: Modular arithmetic
signature: IntegerMod(k, n)
summary: "The old spelling of [[ResidueClass]], kept working: `IntegerMod(k, n)` reads as `ResidueClass(k, n)` as soon as it is boxed."
signatures:
  - call: IntegerMod(k, n)
    description: same as ResidueClass(k, n)
    library: enumeratio-residues
    type: (any, any) -> value
seeAlso:
  - ResidueClass
---
