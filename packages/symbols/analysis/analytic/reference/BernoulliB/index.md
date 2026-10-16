---
name: BernoulliB
domain: Sequences
signature: BernoulliB(n, x?)
summary: The nth Bernoulli number, a rational sequence appearing in power-sum (Faulhaber) formulas and series expansions.
signatures:
  - call: BernoulliB(n)
    description: the nth Bernoulli number $B_n$.
  - call: BernoulliB(n, x)
    description: the Bernoulli polynomial $B_n(x)$.
    library: "@enumeratio/analytic"
    type: (integer, number?) -> number
    overrides: compute-engine
references:
  - system: wikipedia
    identity: Bernoulli number
  - system: mathworld
    identity: BernoulliNumber
  - system: dlmf
    identity: "24.2"
  - system: oeis
    identity: A027641
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: wolfram
    template: BernoulliB[$1]
    arity: 1
    threadArg: 1
  - origin: mapped
    form: sympy
    template: bernoulli($1)
    arity: 1
    threadArg: 1
  - origin: mapped
    form: sage
    template: bernoulli($1)
    arity: 1
    threadArg: 1
  - origin: mapped
    form: sympy
    template: bernoulli($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.14.0
      on: 2026-10-14
  - origin: mapped
    form: mpmath
    template: bernoulli($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.3.0
      on: 2026-10-15
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
    form: sage
    template: bernoulli_polynomial($2, $1)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: julia
    template: bernoulli(Int($1))
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
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

- Defined by the generating function $\dfrac{t}{e^t-1} = \sum_{n=0}^{\infty} B_n \dfrac{t^n}{n!}$.
- $B_n = 0$ for every odd $n > 1$; $B_1 = -\frac12$ under this (the "$B_n^-$") convention.
- Drive Faulhaber's formula for power sums, $\sum_{k=0}^{n-1} k^p = \frac{1}{p+1}\sum_{j=0}^{p}\binom{p+1}{j} B_j\, n^{p+1-j}$. See [[Binomial]].
- Related to the Riemann zeta function: $\zeta(-n) = -\dfrac{B_{n+1}}{n+1}$ for $n \ge 1$, and $\zeta(2n) = \dfrac{(-1)^{n+1} B_{2n} (2\pi)^{2n}}{2\,(2n)!}$.
- compute-engine only defines $B_n$ for nonnegative integer $n$. With a second argument, BernoulliB(n, x) is the Bernoulli polynomial $B_n(x)$, as in Wolfram — the same as [[BernoulliPolynomial]].
