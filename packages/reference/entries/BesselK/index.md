---
name: BesselK
domain: Compute engine
signature: "BesselK(order: complex, complex | infinity) -> number"
summary: Modified Bessel function of the second kind (Macdonald function)
signatures:
  - call: "BesselK(order: complex, complex | infinity) -> number"
    description: as compute-engine declares it
  - call: "BesselK(order: complex, complex | infinity) -> number"
    description: As native, and keeps its digits past a double's for integer order and positive real argument (N(BesselK(0, 4), 50)).
    library: enumeratio-analytic
    type: "(order: complex, complex | infinity) -> number"
    overrides: compute-engine
names:
  dlmf: modified Bessel function of the second kind
  wolframIdentity: true
stub: engine
bindings:
  - origin: mapped
    form: mpmath
    template: besselk($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: julia
    template: enumeratio_ball(bessel_k, $1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
---
