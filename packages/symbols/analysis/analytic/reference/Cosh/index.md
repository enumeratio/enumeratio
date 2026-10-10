---
name: Cosh
domain: Elementary functions
signature: Cosh(x)
summary: 'Hyperbolic cosine: $\cosh(x) = \frac{e^x + e^{-x}}{2}$.'
signatures:
  - call: Cosh(x)
    description: the hyperbolic cosine of x.
  - call: Cosh(x)
    description: 'Hyperbolic cosine: $\cosh(x) = \frac{e^x + e^{-x}}{2}$.'
    library: enumeratio-analytic
    type: (complex | signed_infinity) -> number
    overrides: compute-engine
seeAlso:
  - Sinh
  - Tanh
  - Exp
references:
  - system: wikipedia
    identity: Hyperbolic functions
  - system: mathworld
    identity: HyperbolicCosine
  - system: dlmf
    identity: "4.28"
names:
  dlmf: hyperbolic cosine function
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sympy
    template: cosh($1)
    arity: 1
    threadArg: 1
  - origin: mapped
    form: mpmath
    template: cosh($1)
    arity: 1
    threadArg: 1
  - origin: mapped
    form: sage
    template: cosh($1)
    arity: 1
    threadArg: 1
---

- Defined in terms of [[Exp]]: $\cosh(x) = \frac{e^x + e^{-x}}{2}$.
- Even function: $\cosh(-x) = \cosh(x)$.
- Exact at $x = 0$ as [[Cos]] is: $\cosh(0) = 1$; a floating-point argument, or N(...), gives a numeric result.
