---
name: Power
domain: Compute engine
signature: Power(complex | infinity, complex | signed_infinity) -> number
summary: "Exponentiation: raise a base to a power."
signatures:
  - call: Power(complex | infinity, complex | signed_infinity) -> number
    description: as compute-engine declares it
  - call: Power(complex | infinity, complex | signed_infinity) -> number
    description: "Exponentiation: raise a base to a power."
    library: enumeratio-analytic
    type: (complex | infinity, complex | signed_infinity) -> number
    overrides: compute-engine
  - call: Power(complex | infinity, complex | signed_infinity) -> number
    description: "Exponentiation: raise a base to a power."
    library: enumeratio-hypercomplex
    type: (complex | infinity, complex | signed_infinity) -> number
    overrides: enumeratio-analytic
    symbols:
      - ^(?:i|j|epsilon|e|f|theta|epsilonSymbol|varepsilon|thetaSymbol|vartheta)_\d+$
  - call: Power(complex | infinity, complex | signed_infinity) -> number
    description: "Exponentiation: raise a base to a power."
    library: enumeratio-residues
    type: (complex | infinity, complex | signed_infinity) -> number
    overrides: enumeratio-hypercomplex
    on:
      - IntegerMod
  - call: Power(complex | infinity, complex | signed_infinity) -> number
    description: "Exponentiation: raise a base to a power."
    library: enumeratio-numerals
    type: (complex | infinity, complex | signed_infinity) -> number
    overrides: enumeratio-residues
    on:
      - AdicNumeral
  - call: Power(complex | infinity, complex | signed_infinity) -> number
    description: "Exponentiation: raise a base to a power."
    library: enumeratio-adeles
    type: (complex | infinity, complex | signed_infinity) -> number
    overrides: enumeratio-numerals
    on:
      - Adele
      - Idele
      - ProfiniteNumber
names:
  fungrim: Pow
  wolframIdentity: true
stub: engine
bindings:
  - origin: mapped
    form: sympy
    template: (S($1)**$2)
    arity: 2
  - origin: mapped
    form: mpmath
    template: (($1)**$2)
    arity: 2
  - origin: mapped
    form: sage
    template: (($1)^$2)
    arity: 2
  - origin: mapped
    form: oscar
    template: (big($1)^$2)
    arity: 2
  - origin: mapped
    form: julia
    template: (big($1)^$2)
    arity: 2
  - origin: mapped
    form: mathlib4
    template: ($1 ^ $2)
    arity: 2
  - origin: mapped
    form: rust
    template: power($1, $2)
    arity: 2
---
