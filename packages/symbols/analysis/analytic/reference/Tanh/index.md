---
name: Tanh
domain: Elementary functions
signature: Tanh(x)
summary: 'Hyperbolic tangent: $\tanh(x) = \frac{\sinh(x)}{\cosh(x)}$.'
signatures:
  - call: Tanh(x)
    description: the hyperbolic tangent of x.
  - call: Tanh(x)
    description: 'Hyperbolic tangent: $\tanh(x) = \frac{\sinh(x)}{\cosh(x)}$.'
    library: enumeratio-analytic
    type: (complex | infinity) -> number
    overrides: compute-engine
seeAlso:
  - Sinh
  - Cosh
references:
  - system: wikipedia
    identity: Hyperbolic functions
  - system: mathworld
    identity: HyperbolicTangent
  - system: dlmf
    identity: "4.28"
names:
  dlmf: hyperbolic tangent function
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sympy
    template: tanh($1)
    arity: 1
    threadArg: 1
  - origin: mapped
    form: mpmath
    template: tanh($1)
    arity: 1
    threadArg: 1
  - origin: mapped
    form: sage
    template: tanh($1)
    arity: 1
    threadArg: 1
---

- $\tanh(x) = \frac{\sinh(x)}{\cosh(x)}$, ranging over $(-1, 1)$.
- Odd function: $\tanh(-x) = -\tanh(x)$.
- Same fold-only-with-N(...) behavior as [[Sinh]] and [[Cosh]].
