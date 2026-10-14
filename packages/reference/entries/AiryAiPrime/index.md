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
stub: engine
---
