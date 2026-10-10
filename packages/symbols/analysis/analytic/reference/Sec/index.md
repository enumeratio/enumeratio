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
    type: (complex) -> number
    overrides: compute-engine
seeAlso:
  - Cos
  - Csc
  - Cot
names:
  dlmf: secant function
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sympy
    template: sec($1)
    arity: 1
    threadArg: 1
  - origin: mapped
    form: mpmath
    template: sec($1)
    arity: 1
    threadArg: 1
  - origin: mapped
    form: sage
    template: sec($1)
    arity: 1
    threadArg: 1
---

- $\sec(x) = \frac{1}{\cos(x)}$.
- Even function, period $2\pi$, same as [[Cos]].
- Undefined wherever $\cos(x) = 0$, the same poles as [[Tan]].
