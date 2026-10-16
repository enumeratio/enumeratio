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
    template: (sympify($1).is_odd is True)
    arity: 1
    threadArg: 1
    checked:
      version: 1.14.0
      on: 2026-10-14
    note: Wolfram's OddQ is False unless the operand is an odd integer, so SymPy's undecided `is_odd` (None), as for a symbol or 4.0, reads as False.
  - origin: mapped
    form: julia
    template: is_odd(ZZ($1))
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
---
