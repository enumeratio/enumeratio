---
name: AiryBiPrime
domain: Compute engine
signature: AiryBiPrime(complex | infinity) -> number
summary: Derivative of the Airy function of the second kind
signatures:
  - call: AiryBiPrime(complex | infinity) -> number
    description: as compute-engine declares it
  - call: AiryBiPrime(complex | infinity) -> number
    description: Derivative of the Airy function of the second kind
    library: enumeratio-analytic
    type: (complex | infinity) -> number
    overrides: compute-engine
bindings:
  - origin: mapped
    form: wolfram
    template: AiryBiPrime[$1]
    arity: 1
  - origin: mapped
    form: mpmath
    template: airybi($1, derivative=1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.3.0
      on: 2026-10-15
stub: engine
---
