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
    type: (complex) -> number
    overrides: compute-engine
seeAlso:
  - Sin
  - Sec
  - Cot
names:
  dlmf: cosecant function
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sympy
    template: csc($1)
    arity: 1
    threadArg: 1
    checked:
      version: 1.14.0
      on: 2026-10-14
  - origin: mapped
    form: mpmath
    template: csc($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: julia
    template: enumeratio_ball(_csc, $1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
---

- $\csc(x) = \frac{1}{\sin(x)}$.
- Odd function, period $2\pi$, same as [[Sin]].
- Undefined wherever $\sin(x) = 0$, the same poles as [[Cot]].
