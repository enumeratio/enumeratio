---
name: FallingFactorial
domain: Wolfram
signature: FallingFactorial(x, n)
summary: The falling factorial $x(x-1)\cdots(x-n+1)$ -- Wolfram's own `FactorialPower(x, n)`.
signatures:
  - call: FallingFactorial(x, n)
    description: exact for an integer x and n, numeric otherwise
    library: "@enumeratio/analytic"
    type: (number, number) -> number
seeAlso:
  - RisingFactorial
names:
  wolfram: FactorialPower
bindings:
  - origin: mapped
    form: sympy
    template: ff($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.14.0
      on: 2026-10-14
  - origin: mapped
    form: mpmath
    template: ff($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: sage
    template: falling_factorial($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: julia
    template: enumeratio_ball((a, n) -> _rising(a - n + 1, n), $1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
---
