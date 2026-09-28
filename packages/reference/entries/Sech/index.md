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
stub: engine
---
