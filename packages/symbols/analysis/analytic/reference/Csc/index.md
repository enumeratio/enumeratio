---
name: Csc
domain: Elementary functions
signature: Csc(x)
summary: Cosecant, the reciprocal of [[Sin]].
signatures:
  - call: Csc(x)
    description: the cosecant of x, $\frac{1}{\sin(x)}$.
  - call: Csc(x)
    description: Cosecant, the reciprocal of [[Sin]].
    library: enumeratio-analytic
    type: (complex | signed_infinity | ~oo) -> Indeterminate | number
    overrides: compute-engine
seeAlso:
  - Sin
  - Sec
  - Cot
names:
  dlmf: cosecant function
  wolframIdentity: true
---

- $\csc(x) = \frac{1}{\sin(x)}$.
- Odd function, period $2\pi$, same as [[Sin]].
- Undefined wherever $\sin(x) = 0$, the same poles as [[Cot]].
