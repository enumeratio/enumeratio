---
name: SinIntegral
domain: Compute engine
signature: SinIntegral(complex | infinity) -> number
summary: "Sine integral: ∫₀ˣ sin(t)/t dt."
signatures:
  - call: SinIntegral(complex | infinity) -> number
    description: as compute-engine declares it
stub: engine
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: mpmath
    template: si($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.3.0
      on: 2026-10-15
---
