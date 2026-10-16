---
name: EllipticPi
domain: Compute engine
signature: EllipticPi(complex | infinity, complex | infinity, (complex | infinity)?) -> number
summary: "Elliptic integral of the third kind: complete Π(n|m) with two arguments, incomplete Π(n; φ|m) with three (characteristic first, amplitude second, parameter convention m = k², as in Mathematica)."
signatures:
  - call: EllipticPi(complex | infinity, complex | infinity, (complex | infinity)?) -> number
    description: as compute-engine declares it
  - call: EllipticPi(complex | infinity, complex | infinity, (complex | infinity)?) -> number
    description: "Elliptic integral of the third kind: complete Π(n|m) with two arguments, incomplete Π(n; φ|m) with three (characteristic first, amplitude second, parameter convention m = k², as in Mathematica)."
    library: enumeratio-analytic
    type: (complex | infinity, complex | infinity, (complex | infinity)?) -> number
    overrides: compute-engine
names:
  wolfram: EllipticPi
  dlmf: Legendre's complete elliptic integral of the third kind
stub: engine
bindings:
  - origin: mapped
    form: mpmath
    template: ellippi($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: mpmath
    template: ellippi($1, $2, $3)
    arity: 3
    threadArgOnly:
      - 1
      - 2
      - 3
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: sage
    template: elliptic_pi($1, $2, $3)
    arity: 3
    threadArgOnly:
      - 1
      - 2
      - 3
    checked:
      version: "10.9"
      on: 2026-10-16
---
