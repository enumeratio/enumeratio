---
name: Sech
domain: Compute engine
signature: Sech(complex | signed_infinity) -> number
summary: Hyperbolic secant, the reciprocal of hyperbolic cosine.
signatures:
  - call: Sech(complex | signed_infinity) -> number
    description: as compute-engine declares it
  - call: Sech(complex | signed_infinity) -> number
    description: Hyperbolic secant, the reciprocal of hyperbolic cosine.
    library: enumeratio-analytic
    type: (complex | signed_infinity) -> number
    overrides: compute-engine
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sympy
    template: sech($1)
    arity: 1
    threadArg: 1
  - origin: mapped
    form: mpmath
    template: sech($1)
    arity: 1
    threadArg: 1
  - origin: mapped
    form: sage
    template: sech($1)
    arity: 1
    threadArg: 1
stub: engine
---
