---
name: BesselY
domain: Compute engine
signature: "BesselY(order: complex, complex | infinity) -> number"
summary: Bessel function of the second kind (Neumann function)
signatures:
  - call: "BesselY(order: complex, complex | infinity) -> number"
    description: as compute-engine declares it
  - call: "BesselY(order: complex, complex | infinity) -> number"
    description: As native, and keeps its digits past a double's for integer order and positive real argument (N(BesselY(0, 1), 50)).
    library: enumeratio-analytic
    type: "(order: complex, complex | infinity) -> number"
    overrides: compute-engine
references:
  - system: wikipedia
    identity: Bessel function
  - system: mathworld
    identity: BesselFunctionoftheSecondKind
  - system: dlmf
    identity: "10.2"
names:
  dlmf: Bessel function of the second kind
  wolframIdentity: true
stub: engine
bindings:
  - origin: mapped
    form: mpmath
    template: bessely($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.3.0
      on: 2026-10-15
---
