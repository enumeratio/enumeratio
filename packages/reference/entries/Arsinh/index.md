---
name: Arsinh
domain: Compute engine
signature: Arsinh(complex | signed_infinity) -> number
summary: Inverse hyperbolic sine (area hyperbolic sine).
signatures:
  - call: Arsinh(complex | signed_infinity) -> number
    description: as compute-engine declares it
  - call: Arsinh(complex | signed_infinity | ~oo) -> number | signed_infinity | ~oo
    description: Inverse hyperbolic sine (area hyperbolic sine).
    library: enumeratio-analytic
    type: (complex | signed_infinity | ~oo) -> number | signed_infinity | ~oo
    overrides: compute-engine
names:
  fungrim: Asinh
  dlmf: inverse hyperbolic sine function
  wolfram: ArcSinh
stub: engine
---
