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
    type: (complex | signed_infinity | ~oo) -> number
    overrides: compute-engine
names:
  fungrim: Asinh
  dlmf: inverse hyperbolic sine function
  wolfram: ArcSinh
bindings:
  - origin: mapped
    form: sympy
    template: asinh($1)
    arity: 1
    threadArg: 1
    checked:
      version: 1.14.0
      on: 2026-10-14
  - origin: mapped
    form: mpmath
    template: asinh($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.3.0
      on: 2026-10-15
stub: engine
---
