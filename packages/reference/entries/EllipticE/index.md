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
bindings:
  - origin: mapped
    form: mpmath
    template: ellipe($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: mpmath
    template: ellipe($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: sage
    template: elliptic_ec($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: sage
    template: elliptic_e($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: julia
    template: enumeratio_ball(elliptic_e, $1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
---
