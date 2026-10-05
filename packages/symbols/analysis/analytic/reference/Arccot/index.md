---
name: Arccot
domain: Elementary functions
signature: Arccot(x)
summary: Arccotangent, the inverse of [[Cot]].
signatures:
  - call: Arccot(x)
    description: the value $y$ with $\cot(y) = x$.
  - call: Arccot(x)
    description: Arccotangent, the inverse of [[Cot]].
    library: enumeratio-analytic
    type: (complex | signed_infinity) -> number
    overrides: compute-engine
seeAlso:
  - Cot
  - Arctan
names:
  fungrim: Acot
---

- Stays symbolic even at values where the reciprocal circular functions fold exactly (e.g. $x = 1$) -- wrap in N(...) for a numeric result.
- Differs from Wolfram: the range is $(0, \pi)$, so $Arccot(-1) = 3\pi/4$; Wolfram's `ArcCot` ranges over $[-\pi/2, \pi/2]$ and gives $-\pi/4$.
