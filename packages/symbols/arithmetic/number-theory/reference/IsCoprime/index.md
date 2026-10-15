---
name: IsCoprime
domain: Number theory
signature: IsCoprime(a, b, …)
summary: Tests whether the arguments are pairwise relatively prime.
signatures:
  - call: IsCoprime(a, b, …)
    description: true when every pair of arguments is coprime
    library: enumeratio-number-theory
    type: (number+) -> boolean
seeAlso:
  - GCD
  - IsPrime
names:
  wolfram: CoprimeQ
bindings:
  - origin: mapped
    form: sympy
    template: (igcd($1, $2) == 1)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.14.0
      on: 2026-10-14
---

- Pairwise, not collectively: $\gcd$ of the whole set being 1 is not enough — every pair must itself be coprime.
- Extends to Gaussian integers, over the same [[GCD]] this widens.
- Wolfram's `CoprimeQ`.
