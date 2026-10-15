---
name: SinhIntegral
domain: Compute engine
signature: SinhIntegral(complex | infinity) -> number
summary: "Hyperbolic sine integral: ∫₀ˣ sinh(t)/t dt."
signatures:
  - call: SinhIntegral(complex | infinity) -> number
    description: as compute-engine declares it
stub: engine
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: mpmath
    template: shi($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.3.0
      on: 2026-10-15
---
