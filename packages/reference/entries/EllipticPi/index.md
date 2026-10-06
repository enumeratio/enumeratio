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
---
