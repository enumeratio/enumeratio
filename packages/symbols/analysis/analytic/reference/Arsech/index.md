---
name: Arsech
domain: Elementary functions
signature: Arsech(x)
summary: Inverse hyperbolic secant, the inverse of Sech.
signatures:
  - call: Arsech(x)
    description: the value $y$ with $\operatorname{sech}(y) = x$.
  - call: Arsech(x)
    description: Inverse hyperbolic secant, the inverse of Sech.
    library: enumeratio-analytic
    type: (complex | signed_infinity | ~oo) -> number
    overrides: compute-engine
seeAlso:
  - Arcosh
names:
  wolfram: ArcSech
---
