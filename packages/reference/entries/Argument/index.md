---
name: Argument
domain: Compute engine
signature: Argument(complex | infinity) -> number
summary: Complex argument (phase angle) of a number.
signatures:
  - call: Argument(complex | infinity) -> number
    description: as compute-engine declares it
  - call: Argument(complex | infinity) -> number
    description: As native, and keeps its digits past a double's for a complex number (N(Argument(e + i pi), 20)).
    library: enumeratio-evaluation
    type: (complex | infinity) -> number
    overrides: compute-engine
names:
  fungrim: Arg
  wolfram: Arg
bindings:
  - origin: mapped
    form: sympy
    template: arg($1)
    arity: 1
    threadArg: 1
    checked:
      version: 1.14.0
      on: 2026-10-14
stub: engine
---
