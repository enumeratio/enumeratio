---
name: AiryAi
domain: Compute engine
signature: AiryAi(complex | infinity) -> number
summary: Airy function of the first kind
signatures:
  - call: AiryAi(complex | infinity) -> number
    description: as compute-engine declares it
  - call: AiryAi(complex | infinity) -> number
    description: As native, and keeps its digits past a double's for real argument (N(AiryAi(2), 50)).
    library: enumeratio-analytic
    type: (complex | infinity) -> number
    overrides: compute-engine
references:
  - system: wikipedia
    identity: Airy function
  - system: mathworld
    identity: AiryFunctions
  - system: dlmf
    identity: "9.2"
stub: engine
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: mpmath
    template: airyai($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: sage
    template: airy_ai($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: julia
    template: enumeratio_ball(airy_ai, $1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
---
