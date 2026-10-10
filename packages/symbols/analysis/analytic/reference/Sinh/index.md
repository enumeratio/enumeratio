---
name: Sinh
domain: Elementary functions
signature: Sinh(x)
summary: 'Hyperbolic sine: $\sinh(x) = \frac{e^x - e^{-x}}{2}$.'
signatures:
  - call: Sinh(x)
    description: the hyperbolic sine of x.
  - call: Sinh(x)
    description: 'Hyperbolic sine: $\sinh(x) = \frac{e^x - e^{-x}}{2}$.'
    library: enumeratio-analytic
    type: (complex | signed_infinity) -> number
    overrides: compute-engine
seeAlso:
  - Cosh
  - Tanh
  - Exp
references:
  - system: wikipedia
    identity: Hyperbolic functions
  - system: mathworld
    identity: HyperbolicSine
  - system: dlmf
    identity: "4.28"
names:
  dlmf: hyperbolic sine function
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sympy
    template: sinh($1)
    arity: 1
    threadArg: 1
  - origin: mapped
    form: mpmath
    template: sinh($1)
    arity: 1
    threadArg: 1
  - origin: mapped
    form: sage
    template: sinh($1)
    arity: 1
    threadArg: 1
---

- Defined in terms of [[Exp]]: $\sinh(x) = \frac{e^x - e^{-x}}{2}$.
- Odd function: $\sinh(-x) = -\sinh(x)$.
- Exact at $x = 0$ as [[Sin]] is: $\sinh(0) = 0$; a floating-point argument, or N(...), gives a numeric result.
