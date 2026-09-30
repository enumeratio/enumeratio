---
name: Arcosh
domain: Compute engine
signature: Arcosh(complex | signed_infinity) -> number
summary: Inverse hyperbolic cosine (area hyperbolic cosine).
signatures:
  - call: Arcosh(complex | signed_infinity) -> number
    description: as compute-engine declares it
  - call: Arcosh(complex | signed_infinity | ~oo) -> number | signed_infinity | ~oo
    description: Inverse hyperbolic cosine (area hyperbolic cosine).
    library: enumeratio-analytic
    type: (complex | signed_infinity | ~oo) -> number | signed_infinity | ~oo
    overrides: compute-engine
names:
  fungrim: Acosh
  dlmf: inverse hyperbolic cosine function
  wolfram: ArcCosh
stub: engine
---
