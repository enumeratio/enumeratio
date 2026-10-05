---
name: Multiply
domain: Compute engine
signature: Multiply(number*) -> number
summary: Product of two or more values.
signatures:
  - call: Multiply(number*) -> number
    description: as compute-engine declares it
  - call: Multiply(number*) -> number
    description: Product of two or more values.
    library: enumeratio-analytic
    type: (number*) -> number
    overrides: compute-engine
    on:
      - Around
      - CenteredInterval
      - Interval
    symbols:
      - ^ExponentialE$
  - call: Multiply(number*) -> number
    description: Product of two or more values.
    library: enumeratio-hypercomplex
    type: (number*) -> number
    overrides: enumeratio-analytic
    symbols:
      - ^(?:i|j|epsilon|e|f|theta|epsilonSymbol|varepsilon|thetaSymbol|vartheta)_\d+$
  - call: Multiply(number*) -> number
    description: Product of two or more values.
    library: enumeratio-numerals
    type: (number*) -> number
    overrides: enumeratio-hypercomplex
    on:
      - AdicNumeral
  - call: Multiply(number*) -> number
    description: Product of two or more values.
    library: enumeratio-adeles
    type: (number*) -> number
    overrides: enumeratio-numerals
    on:
      - Adele
      - Idele
      - ProfiniteNumber
names:
  wikidataConfirmed: true
  wolfram: Times
stub: engine
bindings:
  - origin: mapped
    form: sympy
    template: ($**)
  - origin: mapped
    form: mpmath
    template: ($**)
  - origin: mapped
    form: sage
    template: ($**)
  - origin: mapped
    form: oscar
    template: ($**)
  - origin: mapped
    form: julia
    template: ($**)
  - origin: mapped
    form: mathlib4
    template: ($**)
  - origin: mapped
    form: rust
    template: ($**)
attributes:
  - HoldAll
---
