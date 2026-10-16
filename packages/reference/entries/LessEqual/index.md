---
name: LessEqual
domain: Compute engine
signature: LessEqual(any, any*) -> boolean
summary: Less-than-or-equal comparison (less than or equal to).
signatures:
  - call: LessEqual(any, any*) -> boolean
    description: as compute-engine declares it
names:
  wolframIdentity: true
stub: engine
bindings:
  - origin: mapped
    form: sympy
    template: Le($1, $2)
    arity: 2
    checked:
      version: 1.14.0
      on: 2026-10-15
  - origin: mapped
    form: sympy
    template: And(Le($1, $2), Le($2, $3))
    arity: 3
    checked:
      version: 1.14.0
      on: 2026-10-15
    note: A chain is the conjunction of its neighbors.
  - origin: mapped
    form: mpmath
    template: ($1 <= $2)
    arity: 2
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: rust
    template: less_equal($1, $2)
    arity: 2
    checked:
      version: num-rational 0.4.2
      on: 2026-10-16
---
