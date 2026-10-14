---
name: AiryBi
domain: Compute engine
signature: AiryBi(complex | infinity) -> number
summary: Airy function of the second kind
signatures:
  - call: AiryBi(complex | infinity) -> number
    description: as compute-engine declares it
  - call: AiryBi(complex | infinity) -> number
    description: Airy function of the second kind
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
---
