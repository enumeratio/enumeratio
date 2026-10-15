---
name: FresnelC
domain: Compute engine
signature: FresnelC(complex | signed_infinity) -> complex
summary: Fresnel cosine integral.
signatures:
  - call: FresnelC(complex | signed_infinity) -> complex
    description: as compute-engine declares it
stub: engine
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: mpmath
    template: fresnelc($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.3.0
      on: 2026-10-15
---
