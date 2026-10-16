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
seeAlso:
  - Tan
  - Sin
  - Cos
names:
  dlmf: cotangent function
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sympy
    template: cot($1)
    arity: 1
    threadArg: 1
    checked:
      version: 1.14.0
      on: 2026-10-14
  - origin: mapped
    form: mpmath
    template: cot($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: julia
    template: enumeratio_ball(cot, $1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
---

- $\cot(x) = \frac{\cos(x)}{\sin(x)} = \frac{1}{\tan(x)}$.
- Period $\pi$, same as [[Tan]].
- Undefined wherever $\sin(x) = 0$, i.e. at multiples of $\pi$ -- not the same poles as [[Tan]].
