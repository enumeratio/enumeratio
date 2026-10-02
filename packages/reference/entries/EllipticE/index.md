---
name: EllipticE
domain: Compute engine
signature: EllipticE(complex | infinity, (complex | infinity)?) -> number
summary: "Elliptic integral of the second kind: complete E(m) with one argument, incomplete E(φ|m) with two (amplitude first, parameter convention m = k², as in Mathematica)."
signatures:
  - call: EllipticE(complex | infinity, (complex | infinity)?) -> number
    description: as compute-engine declares it
  - call: EllipticE(complex | infinity, (complex | infinity)?) -> number
    description: π/2 at an exact 0 (the values-at-zero patch).
    library: enumeratio-analytic
    type: (complex | infinity, (complex | infinity)?) -> number
    overrides: compute-engine
references:
  - system: wikipedia
    identity: Elliptic integral
  - system: mathworld
    identity: CompleteEllipticIntegraloftheSecondKind
  - system: dlmf
    identity: "19.2"
names:
  wolfram: EllipticE
  dlmf: Legendre's complete elliptic integral of the second kind
stub: engine
---
