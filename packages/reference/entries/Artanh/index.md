---
name: Artanh
domain: Compute engine
signature: Artanh(complex | signed_infinity) -> number
summary: Inverse hyperbolic tangent (area hyperbolic tangent).
signatures:
  - call: Artanh(complex | signed_infinity) -> number
    description: as compute-engine declares it
  - call: Artanh(complex | signed_infinity | ~oo) -> Indeterminate | number | signed_infinity
    description: Inverse hyperbolic tangent (area hyperbolic tangent).
    library: enumeratio-analytic
    type: (complex | signed_infinity | ~oo) -> Indeterminate | number | signed_infinity
    overrides: compute-engine
names:
  fungrim: Atanh
  dlmf: inverse hyperbolic tangent function
  wolfram: ArcTanh
stub: engine
---
