---
name: Beta
domain: Special functions
signature: Beta(a, b)
summary: Euler's beta function $B(a, b) = \Gamma(a)\Gamma(b)/\Gamma(a+b)$, a bridge between [[Gamma]] and [[Binomial]] and the normalizing constant behind the beta distribution.
signatures:
  - call: Beta(a, b)
    description: the Euler beta function $B(a, b)$.
  - call: Beta(a, b)
    description: Euler's beta function $B(a, b) = \Gamma(a)\Gamma(b)/\Gamma(a+b)$, a bridge between [[Gamma]] and [[Binomial]] and the normalizing constant behind the beta distribution.
    library: enumeratio-analytic
    type: (number, number, number?, number?) -> number
    overrides: compute-engine
seeAlso:
  - Gamma
  - Binomial
  - BetaRegularized
references:
  - system: wikipedia
    identity: Beta function
  - system: mathworld
    identity: BetaFunction
  - system: dlmf
    identity: "5.12"
names:
  fungrim: BetaFunction
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sympy
    template: beta($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.14.0
      on: 2026-10-14
  - origin: mapped
    form: mpmath
    template: beta($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: mpmath
    template: betainc($2, $3, 0, $1)
    arity: 3
    threadArgOnly:
      - 1
      - 2
      - 3
    note: Incomplete beta B(z; a, b), the integral from 0 to z.
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: mpmath
    template: betainc($3, $4, $1, $2)
    arity: 4
    threadArgOnly:
      - 1
      - 2
      - 3
      - 4
    note: Generalized incomplete beta, the integral from z0 to z1.
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: sage
    template: beta($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: "10.9"
      on: 2026-10-16
---

- Defined via [[Gamma]]: $B(a, b) = \dfrac{\Gamma(a)\,\Gamma(b)}{\Gamma(a+b)}$.
- Symmetric: $B(a, b) = B(b, a)$.
- Integral form: $B(a, b) = \int_0^1 t^{a-1}(1-t)^{b-1}\,dt$.
- Ties to [[Binomial]]: $B(k+1, n-k+1) = \dfrac{1}{(n+1)\binom{n}{k}}$.
- compute-engine evaluates Beta exactly for positive-integer a and b (an exact rational result) and detects the poles at nonpositive integers, returning ComplexInfinity.
