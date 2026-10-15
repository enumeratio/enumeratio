---
name: IsOdd
domain: Arithmetic
signature: IsOdd(n)
summary: Whether n is an odd integer.
signatures:
  - call: IsOdd(n)
    description: $True$ if $n$ is an odd integer, else $False$.
  - call: IsOdd(n)
    description: Whether n is an odd integer.
    library: enumeratio-analytic
    type: (number) -> boolean
    overrides: compute-engine
seeAlso:
  - IsEven
names:
  wolfram: OddQ
bindings:
  - origin: mapped
    form: sympy
    template: (($1) % 2 == 1)
    arity: 1
    threadArg: 1
    checked:
      version: 1.14.0
      on: 2026-10-14
---
