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
bindings:
  - origin: mapped
    form: mpmath
    template: ellipf($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    note: Amplitude first, then the parameter m, as in Wolfram.
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: sage
    template: elliptic_f($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: "10.9"
      on: 2026-10-16
---
