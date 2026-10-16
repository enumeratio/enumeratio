---
name: Trigamma
domain: Compute engine
signature: Trigamma(complex | infinity) -> number
summary: Trigamma function, the derivative of the digamma function
signatures:
  - call: Trigamma(complex | infinity) -> number
    description: as compute-engine declares it
references:
  - system: wikipedia
    identity: Trigamma function
  - system: mathworld
    identity: TrigammaFunction
  - system: dlmf
    identity: "5.15"
names:
  dlmf: polygamma functions
bindings:
  - origin: mapped
    form: wolfram
    template: PolyGamma[1, $1]
    arity: 1
  - origin: mapped
    form: mpmath
    template: psi(1, $1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: julia
    template: enumeratio_ball(z -> polygamma(CC(1), z), $1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
stub: engine
---
