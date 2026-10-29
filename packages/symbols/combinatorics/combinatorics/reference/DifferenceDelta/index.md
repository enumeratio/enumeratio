---
name: DifferenceDelta
domain: Collections
signature: DifferenceDelta(f, n)
summary: f(n+1) - f(n), simplified -- the forward difference of a sequence.
signatures:
  - call: DifferenceDelta(f, n)
    description: f(n+1) - f(n), simplified
    library: enumeratio-combinatorics
    type: (any, symbol) -> any
bindings:
  - origin: mapped
    form: sympy
    template: difference_delta($1, $2)
    arity: 2
    checked:
      version: 1.14.0
      on: 2026-10-28
seeAlso:
  - DiscreteRatio
names:
  wolframIdentity: true
attributes:
  - HoldAll
---

- Substitutes n -> n+1 into f and simplifies the difference; stays symbolic when it does not collapse further.
