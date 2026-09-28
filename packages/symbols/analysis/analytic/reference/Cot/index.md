---
name: Cot
domain: Elementary functions
signature: Cot(x)
summary: Cotangent, the reciprocal of [[Tan]].
signatures:
  - call: Cot(x)
    description: the cotangent of x, $\frac{1}{\tan(x)}$.
  - call: Cot(x)
    description: Cotangent, the reciprocal of [[Tan]].
    library: enumeratio-analytic
    type: (complex) -> number
    overrides: compute-engine
details:
  - $\cot(x) = \frac{\cos(x)}{\sin(x)} = \frac{1}{\tan(x)}$.
  - Period $\pi$, same as [[Tan]].
  - Undefined wherever $\sin(x) = 0$, i.e. at multiples of $\pi$ -- not the same poles as [[Tan]].
seeAlso:
  - Tan
  - Sin
  - Cos
names:
  dlmf: cotangent function
  wolframIdentity: true
---
