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
---
