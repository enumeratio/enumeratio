---
name: BesselI
domain: Compute engine
signature: "BesselI(order: complex, complex | infinity) -> number"
summary: Modified Bessel function of the first kind
signatures:
  - call: "BesselI(order: complex, complex | infinity) -> number"
    description: as compute-engine declares it
  - call: "BesselI(order: complex, complex | infinity) -> number"
    description: As native, and keeps its digits past a double's for integer order and real argument (N(BesselI(1, 1), 40)).
    library: enumeratio-analytic
    type: "(order: complex, complex | infinity) -> number"
    overrides: compute-engine
names:
  dlmf: modified Bessel function of the first kind
  wolframIdentity: true
stub: engine
---
