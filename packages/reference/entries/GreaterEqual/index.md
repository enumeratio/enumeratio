---
name: GreaterEqual
domain: Compute engine
signature: GreaterEqual(any, any*) -> boolean
summary: Greater-than-or-equal comparison (greater than or equal to).
signatures:
  - call: GreaterEqual(any, any*) -> boolean
    description: as compute-engine declares it
names:
  wolframIdentity: true
stub: engine
bindings:
  - origin: mapped
    form: sympy
    template: Ge($1, $2)
    arity: 2
    checked:
      version: 1.14.0
      on: 2026-10-15
  - origin: mapped
    form: sympy
    template: And(Ge($1, $2), Ge($2, $3))
    arity: 3
    checked:
      version: 1.14.0
      on: 2026-10-15
    note: A chain is the conjunction of its neighbors.
  - origin: mapped
    form: rust
    template: greater_equal($1, $2)
    arity: 2
    checked:
      version: num-rational 0.4.2
      on: 2026-10-16
---
