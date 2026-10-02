---
name: EllipticK
domain: Compute engine
signature: EllipticK(complex | infinity) -> number
summary: Complete elliptic integral of the first kind K(m), parameter convention m = k².
signatures:
  - call: EllipticK(complex | infinity) -> number
    description: as compute-engine declares it
  - call: EllipticK(complex | infinity) -> number
    description: π/2 at an exact 0 (the values-at-zero patch).
    library: enumeratio-analytic
    type: (complex | infinity) -> number
    overrides: compute-engine
references:
  - system: wikipedia
    identity: Elliptic integral
  - system: mathworld
    identity: CompleteEllipticIntegraloftheFirstKind
  - system: dlmf
    identity: "19.2"
names:
  wolfram: EllipticK
  dlmf: Legendre's complete elliptic integral of the first kind
stub: engine
---
