---
name: Not
domain: Compute engine
signature: Not(boolean) -> boolean
summary: Logical negation (NOT).
signatures:
  - call: Not(boolean) -> boolean
    description: as compute-engine declares it
names:
  wolframIdentity: true
stub: engine
bindings:
  - origin: mapped
    form: sympy
    template: Not($1)
    arity: 1
    checked:
      version: 1.14.0
      on: 2026-10-15
---
