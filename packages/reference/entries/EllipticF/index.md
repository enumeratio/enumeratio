---
name: EllipticF
domain: Compute engine
signature: EllipticF(complex | infinity, complex | infinity) -> number
summary: Incomplete elliptic integral of the first kind F(φ|m) (amplitude first, parameter convention m = k², as in Mathematica). F(π/2|m) = K(m).
signatures:
  - call: EllipticF(complex | infinity, complex | infinity) -> number
    description: as compute-engine declares it
  - call: EllipticF(complex | infinity, complex | infinity) -> number
    description: Incomplete elliptic integral of the first kind F(φ|m) (amplitude first, parameter convention m = k², as in Mathematica). F(π/2|m) = K(m).
    library: enumeratio-analytic
    type: (complex | infinity, complex | infinity) -> number
    overrides: compute-engine
names:
  wolfram: EllipticF
stub: engine
---
