---
name: ExpIntegralEi
domain: Compute engine
signature: ExpIntegralEi(complex | infinity) -> number
summary: Exponential integral Ei(x) = PV ∫_{−∞}^x eᵗ/t dt.
signatures:
  - call: ExpIntegralEi(complex | infinity) -> number
    description: as compute-engine declares it
  - call: ExpIntegralEi(complex | infinity) -> number
    description: As native, and keeps its digits past a double's for real argument (N(ExpIntegralEi(2), 50)).
    library: enumeratio-analytic
    type: (complex | infinity) -> number
    overrides: compute-engine
stub: engine
names:
  wolframIdentity: true
---
