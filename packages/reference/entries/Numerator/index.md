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
    overrides: enumeratio-number-theory
    on:
      - ProfiniteNumber
  - call: Numerator(number) -> nothing | number
    description: Numerator of an expression
    library: enumeratio-number-theory
    type: (number, any*) -> nothing | number
    overrides: enumeratio-residues
  - call: Numerator(number) -> nothing | number
    description: Numerator of an expression
    library: enumeratio-residues
    type: (number, any*) -> nothing | number
    overrides: compute-engine
statOn:
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
  - origin: mapped
    form: julia
    template: numerator($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
  - origin: mapped
    form: rust
    template: numerator($1)
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

- `Over -> QuotientRing(Integers, p)` (Wolfram's `Modulus -> p`, p prime) reads the expression over the field $\mathbb{Z}/p$ (`@enumeratio/residues`): a quotient in lowest terms over $\mathbb{Q}$ with integer coefficients, then its coefficients mod p. A constant denominator, and a monomial one when no polynomial divides anywhere, moves its unit into the numerator ($x/(2y) \to 4x/y$ mod 7). It stays unevaluated where Wolfram has no answer, as for a denominator that vanishes mod p. It threads over a list. The unit of a denominator of several terms follows Wolfram's convention for a single unknown; with several unknowns the result may differ from Wolfram's by a unit (the same function). `Over -> Integers` is the ordinary numerator.
