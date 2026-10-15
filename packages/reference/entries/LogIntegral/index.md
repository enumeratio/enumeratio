---
name: LogIntegral
domain: Compute engine
signature: LogIntegral(complex | infinity) -> number
summary: Logarithmic integral li(x) = PV ∫₀ˣ dt/ln t = Ei(ln x).
signatures:
  - call: LogIntegral(complex | infinity) -> number
    description: as compute-engine declares it
  - call: LogIntegral(complex | infinity) -> number
    description: As native, and keeps its digits past a double's for positive real argument (N(LogIntegral(2), 50)).
    library: enumeratio-analytic
    type: (complex | infinity) -> number
    overrides: compute-engine
stub: engine
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: mpmath
    template: li($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.3.0
      on: 2026-10-15
---
