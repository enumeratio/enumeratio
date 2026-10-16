---
name: FresnelS
domain: Compute engine
signature: FresnelS(complex | signed_infinity) -> complex
summary: Fresnel sine integral.
signatures:
  - call: FresnelS(complex | signed_infinity) -> complex
    description: as compute-engine declares it
stub: engine
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: mpmath
    template: fresnels($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.3.0
      on: 2026-10-15
---
