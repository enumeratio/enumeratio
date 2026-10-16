---
name: AiryAiPrime
domain: Compute engine
signature: AiryAiPrime(complex | infinity) -> number
summary: Derivative of the Airy function of the first kind
signatures:
  - call: AiryAiPrime(complex | infinity) -> number
    description: as compute-engine declares it
  - call: AiryAiPrime(complex | infinity) -> number
    description: Derivative of the Airy function of the first kind
    library: enumeratio-analytic
    type: (complex | infinity) -> number
    overrides: compute-engine
bindings:
  - origin: mapped
    form: wolfram
    template: AiryAiPrime[$1]
    arity: 1
  - origin: mapped
    form: mpmath
    template: airyai($1, derivative=1)
    arity: 1
    threadArgOnly: 1
    note: The first derivative.
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: julia
    template: enumeratio_ball(airy_ai_prime, $1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
stub: engine
---
