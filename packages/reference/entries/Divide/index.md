---
name: Divide
domain: Compute engine
signature: Divide(complex | infinity, (complex | infinity)+) -> number
summary: Quotient of a numerator and one or more denominators.
signatures:
  - call: Divide(complex | infinity, (complex | infinity)+) -> number
    description: as compute-engine declares it
  - call: Divide(complex | infinity, (complex | infinity)+) -> number
    description: Quotient of a numerator and one or more denominators.
    library: enumeratio-analytic
    type: (complex | infinity, (complex | infinity)+) -> number
    overrides: compute-engine
    on:
      - Around
      - CenteredInterval
      - Interval
  - call: Divide(complex | infinity, (complex | infinity)+) -> number
    description: Quotient of a numerator and one or more denominators.
    library: enumeratio-hypercomplex
    type: (complex | infinity, (complex | infinity)+) -> number
    overrides: enumeratio-analytic
    symbols:
      - ^(?:i|j|epsilon|e|f|theta|epsilonSymbol|varepsilon|thetaSymbol|vartheta)_\d+$
  - call: Divide(complex | infinity, (complex | infinity)+) -> number
    description: Quotient of a numerator and one or more denominators.
    library: enumeratio-residues
    type: (complex | infinity, (complex | infinity)+) -> number
    overrides: enumeratio-hypercomplex
    on:
      - IntegerMod
  - call: Divide(complex | infinity, (complex | infinity)+) -> number
    description: Quotient of a numerator and one or more denominators.
    library: enumeratio-numerals
    type: (complex | infinity, (complex | infinity)+) -> number
    overrides: enumeratio-residues
    on:
      - AdicNumeral
  - call: Divide(complex | infinity, (complex | infinity)+) -> number
    description: Quotient of a numerator and one or more denominators.
    library: enumeratio-adeles
    type: (complex | infinity, (complex | infinity)+) -> number
    overrides: enumeratio-numerals
    on:
      - Adele
      - Idele
      - ProfiniteNumber
names:
  wikidataConfirmed: true
  wolframIdentity: true
stub: engine
bindings:
  - origin: mapped
    form: sympy
    template: (S($1) / $2)
    arity: 2
  - origin: mapped
    form: sage
    template: ($1 / $2)
    arity: 2
  - origin: mapped
    form: oscar
    template: ($1 // $2)
    arity: 2
  - origin: mapped
    form: julia
    template: ($1 // $2)
    arity: 2
  - origin: mapped
    form: mathlib4
    template: "(($1 : ℚ) / $2)"
    arity: 2
  - origin: mapped
    form: rust
    template: ($1 / $2)
    arity: 2
---
