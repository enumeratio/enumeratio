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
bindings:
  - origin: mapped
    form: mpmath
    template: ellipk($1)
    arity: 1
    threadArgOnly: 1
    note: The parameter m, not the modulus k, as in Wolfram.
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: sage
    template: elliptic_kc($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: julia
    template: enumeratio_ball(elliptic_k, $1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
---
