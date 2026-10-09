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
---
