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
    template: (($1) % 2 == 0)
    arity: 1
    threadArg: 1
    checked:
      version: 1.14.0
      on: 2026-10-14
---
