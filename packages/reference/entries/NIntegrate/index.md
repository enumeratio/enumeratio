---
name: NIntegrate
domain: Compute engine
signature: NIntegrate(f, a, b)
summary: The numeric integral of a function between two bounds.
signatures:
  - call: NIntegrate(f, a, b)
    description: Over a semi-infinite interval, an oscillatory integrand that isn't finite at the finite end has its first lobe integrated without evaluating it there, where compute-engine drops the sliver next to the end; lobes that beat leave the call unevaluated. Falls back to compute-engine's native quadrature otherwise.
    library: enumeratio-analytic
    type: "(function, lower: number, upper: number) -> number"
    overrides: compute-engine
attributes:
  - HoldAll
---
