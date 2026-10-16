---
name: Coth
domain: Compute engine
signature: Coth(complex | signed_infinity) -> number
summary: Hyperbolic cotangent, the reciprocal of hyperbolic tangent.
signatures:
  - call: Coth(complex | signed_infinity) -> number
    description: as compute-engine declares it
  - call: Coth(complex | signed_infinity) -> number
    description: Hyperbolic cotangent, the reciprocal of hyperbolic tangent.
    library: enumeratio-analytic
    type: (complex | signed_infinity) -> number
    overrides: compute-engine
names:
  dlmf: hyperbolic cotangent function
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sympy
    template: coth($1)
    arity: 1
    threadArg: 1
    checked:
      version: 1.14.0
      on: 2026-10-14
  - origin: mapped
    form: mpmath
    template: coth($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: sage
    template: coth($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: "10.9"
      on: 2026-10-16
stub: engine
---
