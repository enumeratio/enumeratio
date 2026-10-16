---
name: Less
domain: Compute engine
signature: Less(any, any*) -> boolean
summary: Less-than comparison (strictly less than).
signatures:
  - call: Less(any, any*) -> boolean
    description: as compute-engine declares it
names:
  wolframIdentity: true
stub: engine
bindings:
  - origin: mapped
    form: sympy
    template: Lt($1, $2)
    arity: 2
    checked:
      version: 1.14.0
      on: 2026-10-15
  - origin: mapped
    form: sympy
    template: And(Lt($1, $2), Lt($2, $3))
    arity: 3
    checked:
      version: 1.14.0
      on: 2026-10-15
    note: A chain is the conjunction of its neighbors.
  - origin: mapped
    form: mpmath
    template: ($1 < $2)
    arity: 2
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: rust
    template: less($1, $2)
    arity: 2
    checked:
      version: num-rational 0.4.2
      on: 2026-10-16
---
