---
name: List
domain: Compute engine
signature: List(any*) -> list
summary: An ordered collection of elements (a list).
signatures:
  - call: List(any*) -> list
    description: as compute-engine declares it
names:
  wolframIdentity: true
stub: engine
bindings:
  - origin: mapped
    form: sympy
    template: "[$*,]"
  - origin: mapped
    form: mpmath
    template: "[$*,]"
  - origin: mapped
    form: sage
    template: "[$*,]"
  - origin: mapped
    form: oscar
    template: "[$*,]"
  - origin: mapped
    form: julia
    template: Any[$*,]
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
  - origin: mapped
    form: mathlib4
    template: "[$*,]"
  - origin: mapped
    form: rust
    template: list(vec![$*,])
---
