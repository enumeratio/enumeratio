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
---
