---
name: Or
domain: Compute engine
signature: Or(boolean+) -> boolean
summary: "Logical disjunction (OR): true when at least one operand is true. Short-circuits: operands are evaluated left to right and evaluation stops at the first `True`."
signatures:
  - call: Or(boolean+) -> boolean
    description: as compute-engine declares it
names:
  wolframIdentity: true
stub: engine
bindings:
  - origin: mapped
    form: sympy
    template: Or($*,)
    checked:
      version: 1.14.0
      on: 2026-10-15
---
