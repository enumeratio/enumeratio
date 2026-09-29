---
name: NumberQ
domain: Collections
signature: NumberQ(expr)
summary: True only for an explicit numeric literal — a symbolic constant like Pi is NOT NumberQ.
signatures:
  - call: NumberQ(expr)
    description: True for an Integer/Real/Rational/Complex literal, False otherwise
    library: enumeratio-combinatorics
    type: (any) -> boolean
seeAlso:
  - ReIm
names:
  wolframIdentity: true
---

- Unlike compute-engine's own isNumber (True for Pi, GoldenRatio, …), NumberQ(Pi) is False — Wolfram's own distinction, kernel-checked (`NumberQ[Pi]` is False, `NumberQ[N[Pi]]` is True).
