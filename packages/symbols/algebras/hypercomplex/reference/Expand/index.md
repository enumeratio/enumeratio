---
name: Expand
domain: Hypercomplex algebra
signature: Expand(x)
summary: Put a hypercomplex element $x$ in blade normal form — for a hypercomplex operand, the same result the multivector arithmetic already produces.
signatures:
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
---
