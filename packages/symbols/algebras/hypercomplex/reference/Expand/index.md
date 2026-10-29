---
name: Expand
domain: Hypercomplex algebra
signature: Expand(x)
summary: Expand out products and positive integer powers; for a hypercomplex operand, puts $x$ in blade normal form — the same result the multivector arithmetic already produces.
signatures:
  - call: Expand(x)
    description: expand out products and positive integer powers.
    type: (value) -> value
  - call: Expand(x)
    description: evaluates a finite Product or Sum first, then expands what it comes to.
    library: enumeratio-combinatorics
    type: (value) -> value
    overrides: enumeratio-hypercomplex
  - call: Expand(x)
    description: $x$ in blade normal form
    library: enumeratio-hypercomplex
    type: (value) -> value
    overrides: compute-engine
attributes:
  - HoldAll
seeAlso:
  - NonCommutativeMultiply
  - Basis
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sage
    template: SR($1).expand()
    arity: 1
    threadArgOnly: 1
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: sympy
    template: expand($1)
    arity: 1
    checked:
      version: 1.14.0
      on: 2026-10-28
---
