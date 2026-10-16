---
name: Real
domain: Compute engine
signature: Real(complex | infinity) -> number
summary: Real part of a complex number.
signatures:
  - call: Real(complex | infinity) -> number
    description: as compute-engine declares it
  - call: Real(complex | infinity) -> number
    description: the real part; of a directed infinity, the infinity of its sign, or 0 when it has none.
    library: enumeratio-analytic
    type: (complex | infinity) -> number
    overrides: compute-engine
names:
  fungrim: Re
  wolfram: Re
bindings:
  - origin: mapped
    form: sympy
    template: re($1)
    arity: 1
    threadArg: 1
    checked:
      version: 1.14.0
      on: 2026-10-14
  - origin: mapped
    form: mpmath
    template: re($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: sage
    template: real_part($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: julia
    template: enumeratio_ball(real, $1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
---
