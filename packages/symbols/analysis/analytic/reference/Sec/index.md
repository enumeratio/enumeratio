---
name: Sec
domain: Elementary functions
signature: Sec(x)
summary: Secant, the reciprocal of [[Cos]].
signatures:
  - call: Sec(x)
    description: the secant of x, $\frac{1}{\cos(x)}$.
  - call: Sec(x)
    description: Secant, the reciprocal of [[Cos]].
    library: enumeratio-analytic
    type: (complex | signed_infinity | ~oo) -> Indeterminate | number
    overrides: compute-engine
seeAlso:
  - Cos
  - Csc
  - Cot
names:
  dlmf: secant function
  wolframIdentity: true
---

- $\sec(x) = \frac{1}{\cos(x)}$.
- Even function, period $2\pi$, same as [[Cos]].
- Undefined wherever $\cos(x) = 0$, the same poles as [[Tan]].
