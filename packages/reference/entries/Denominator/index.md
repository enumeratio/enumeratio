---
name: Denominator
domain: Compute engine
signature: Denominator(number) -> nothing | number
summary: Denominator of an expression
signatures:
  - call: Denominator(number) -> nothing | number
    description: as compute-engine declares it
  - call: Denominator(number) -> nothing | number
    description: Denominator of an expression
    library: enumeratio-adeles
    type: (number | value) -> nothing | number
    overrides: compute-engine
statOn:
  - BinaryWord
  - RationalNumber
stub: engine
bindings:
  - origin: mapped
    form: sage
    template: ($1).denominator()
    arity: 1
    note: Generic -- works for a plain rational/integer and for a ProfiniteNumber's Sage counterpart (Qhat) alike.
    checked:
      version: "10.9"
      on: 2026-09-28
attributes:
  - HoldAll
---
