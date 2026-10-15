---
name: Arcsch
domain: Elementary functions
signature: Arcsch(x)
summary: Inverse hyperbolic cosecant, the inverse of Csch.
signatures:
  - call: Arcsch(x)
    description: the value $y$ with $\operatorname{csch}(y) = x$.
  - call: Arcsch(x)
    description: Inverse hyperbolic cosecant, the inverse of Csch.
    library: enumeratio-analytic
    type: (complex | infinity) -> number
    overrides: compute-engine
seeAlso:
  - Arsinh
names:
  wolfram: ArcCsch
bindings:
  - origin: mapped
    form: sympy
    template: acsch($1)
    arity: 1
    threadArg: 1
    checked:
      version: 1.14.0
      on: 2026-10-14
---
