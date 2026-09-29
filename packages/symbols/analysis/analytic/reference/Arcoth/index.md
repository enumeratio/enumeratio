---
name: Arcoth
domain: Elementary functions
signature: Arcoth(x)
summary: Inverse hyperbolic cotangent, the inverse of Coth.
signatures:
  - call: Arcoth(x)
    description: the value $y$ with $\coth(y) = x$.
  - call: Arcoth(x)
    description: Inverse hyperbolic cotangent, the inverse of Coth.
    library: enumeratio-analytic
    type: (complex | infinity) -> number
    overrides: compute-engine
seeAlso:
  - Artanh
names:
  wolfram: ArcCoth
---

- Stays symbolic at plain evaluation, same as [[Arsinh]]-family functions; wrap in N(...).
