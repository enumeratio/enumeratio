---
name: Numerator
domain: Compute engine
signature: Numerator(number) -> nothing | number
summary: Numerator of an expression
signatures:
  - call: Numerator(number) -> nothing | number
    description: as compute-engine declares it
  - call: Numerator(number) -> nothing | number
    description: Numerator of an expression
    library: enumeratio-adeles
    type: (value) -> value
    overrides: compute-engine
    on:
      - ProfiniteNumber
statOn:
  - BinaryWord
  - RationalNumber
stub: engine
bindings:
  - origin: mapped
    form: sage
    template: ($1).numerator()
    arity: 1
    note: Generic -- works for a plain rational/integer and for a ProfiniteNumber's Sage counterpart (Qhat) alike.
    checked:
      version: "10.9"
      on: 2026-09-28
attributes:
  - HoldAll
---
