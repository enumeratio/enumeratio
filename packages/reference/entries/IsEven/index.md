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
---
