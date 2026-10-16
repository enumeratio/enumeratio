---
name: IsEven
domain: Arithmetic
signature: IsEven(n)
summary: Whether n is an even integer.
signatures:
  - call: IsEven(n)
    description: $True$ if $n$ is an even integer, else $False$.
seeAlso:
  - IsOdd
names:
  wolfram: EvenQ
bindings:
  - origin: mapped
    form: sympy
    template: (sympify($1).is_even is True)
    arity: 1
    threadArg: 1
    checked:
      version: 1.14.0
      on: 2026-10-14
    note: Wolfram's EvenQ is False unless the operand is an even integer, so SymPy's undecided `is_even` (None), as for a symbol or 4.0, reads as False.
  - origin: mapped
    form: julia
    template: is_even(ZZ($1))
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
  - origin: mapped
    form: rust
    template: is_even($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: num-integer 0.1.47
      on: 2026-10-16
---
