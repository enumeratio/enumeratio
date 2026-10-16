---
name: Csch
domain: Compute engine
signature: Csch(complex | signed_infinity) -> number
summary: Hyperbolic cosecant, the reciprocal of hyperbolic sine.
signatures:
  - call: Csch(complex | signed_infinity) -> number
    description: as compute-engine declares it
  - call: Csch(complex | signed_infinity) -> number
    description: Hyperbolic cosecant, the reciprocal of hyperbolic sine.
    library: enumeratio-analytic
    type: (complex | signed_infinity) -> number
    overrides: compute-engine
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sympy
    template: csch($1)
    arity: 1
    threadArg: 1
    checked:
      version: 1.14.0
      on: 2026-10-14
  - origin: mapped
    form: mpmath
    template: csch($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: sage
    template: csch($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: julia
    template: enumeratio_ball(_csch, $1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
  - origin: mapped
    form: rust
    template: (n(1) / sinh($1))
    arity: 1
    threadArgOnly: 1
    note: The reciprocal of sinh.
    checked:
      version: rustc 1.98.1
      on: 2026-10-16
stub: engine
---
