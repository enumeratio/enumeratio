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
---
