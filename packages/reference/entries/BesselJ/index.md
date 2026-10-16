---
name: BesselJ
domain: Compute engine
signature: "BesselJ(order: complex, complex | infinity) -> number"
summary: Bessel function of the first kind
signatures:
  - call: "BesselJ(order: complex, complex | infinity) -> number"
    description: as compute-engine declares it
  - call: "BesselJ(order: complex, complex | infinity) -> number"
    description: As native, and keeps its digits past a double's for integer order and real argument (N(BesselJ(1, 300), 25)).
    library: enumeratio-analytic
    type: "(order: complex, complex | infinity) -> number"
    overrides: compute-engine
references:
  - system: wikipedia
    identity: Bessel function
  - system: mathworld
    identity: BesselFunctionoftheFirstKind
  - system: dlmf
    identity: "10.2"
names:
  dlmf: Bessel function of the first kind
  wolframIdentity: true
stub: engine
bindings:
  - origin: mapped
    form: mpmath
    template: besselj($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: julia
    template: enumeratio_ball(bessel_j, $1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
---
