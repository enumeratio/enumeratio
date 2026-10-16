---
name: EulerE
domain: Number theory
signature: EulerE(n, x?)
summary: The Euler numbers $E_n$ and Euler polynomials $E_n(x)$.
signatures:
  - call: EulerE(n)
    description: the $n$th Euler number
    library: enumeratio-number-theory
    type: (value, expression?) -> expression | list<number> | number
  - call: EulerE(n, x)
    description: the $n$th Euler polynomial, evaluated at $x$
    library: enumeratio-number-theory
seeAlso:
  - BernoulliB
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sympy
    template: euler($1)
    arity: 1
    threadArg: 1
    checked:
      version: 1.14.0
      on: 2026-10-14
  - origin: mapped
    form: sympy
    template: euler($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.14.0
      on: 2026-10-14
  - origin: mapped
    form: mpmath
    template: eulernum($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: mpmath
    template: eulerpoly($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: sage
    template: euler_number($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---

- Odd-indexed Euler numbers past $E_0$ are 0; the even ones come from $\sum_{k=0}^{n/2}\binom{n}{2k}E_{2k}=0$.
- $E_n = 2^n E_n(\frac12)$ ties the numbers to the polynomials.
- Not to be confused with [[BernoulliB]] or [[EulerGamma]].
