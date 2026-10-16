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
    type: (value) -> integer
    overrides: enumeratio-number-theory
    on:
      - ProfiniteNumber
  - call: Denominator(number) -> nothing | number
    description: Denominator of an expression
    library: enumeratio-number-theory
    type: (number, any*) -> nothing | number
    overrides: enumeratio-residues
  - call: Denominator(number) -> nothing | number
    description: Denominator of an expression
    library: enumeratio-residues
    type: (number, any*) -> nothing | number
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
  - origin: mapped
    form: julia
    template: denominator($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
  - origin: mapped
    form: rust
    template: denominator($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: num-rational 0.4.2
      on: 2026-10-16
attributes:
  - HoldAll
names:
  wolframIdentity: true
---
