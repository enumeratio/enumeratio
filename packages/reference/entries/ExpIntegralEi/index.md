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
bindings:
  - origin: mapped
    form: mpmath
    template: ei($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: sage
    template: exp_integral_ei($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---
