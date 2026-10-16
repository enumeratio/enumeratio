---
name: BernoulliPolynomial
domain: Wolfram
signature: BernoulliPolynomial(n, x)
summary: The Bernoulli polynomial $B_n(x)$ -- Wolfram's own `BernoulliB(n, x)`.
signatures:
  - call: BernoulliPolynomial(n, x)
    description: exact for a symbolic or exact x, numeric via BernoulliB's own kernel otherwise
    library: "@enumeratio/analytic"
    type: (integer, number) -> number
seeAlso:
  - BernoulliB
names:
  wolfram: BernoulliB
bindings:
  - origin: mapped
    form: mpmath
    template: bernpoly($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: julia
    template: enumeratio_bernoulli_poly($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
---
