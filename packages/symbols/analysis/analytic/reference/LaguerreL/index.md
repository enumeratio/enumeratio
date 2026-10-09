---
name: LaguerreL
domain: Special functions
signature: LaguerreL(n, x)
summary: The Laguerre polynomial $L_n(x)$, and its generalization $L_n^{(a)}(x)$ with a parameter $a$, orthogonal on $(0, \infty)$ with weight $x^a e^{-x}$. Provided by `@enumeratio/analytic`.
signatures:
  - call: LaguerreL(n, x)
    description: the Laguerre polynomial $L_n(x)$ at $x$, for an integer $n \ge 0$.
    library: "@enumeratio/analytic"
    type: (number, number, number?) -> number
  - call: LaguerreL(n, a, x)
    description: the generalized Laguerre polynomial $L_n^{(a)}(x)$ at $x$, for an integer $n \ge 0$ and any $a$.
    library: "@enumeratio/analytic"
bindings:
  - origin: reference
    form: notatio
    environment: engine
    expr:
      [
        Sum,
        [
          Multiply,
          [Power, -1, k],
          [Binomial, [Add, _n, _a], [Subtract, _n, k]],
          [Power, _x, k],
          [Power, [Factorial, k], -1],
        ],
        [Triple, k, 0, _n],
      ]
    note: The explicit sum over $k$ up to $n$, with $a = 0$ for the two-argument form. The kernel runs the three-term recurrence at a number instead, and the two are checked against each other.
  - origin: native
    form: typescript
    environment: engine
    source: packages/symbols/analysis/analytic/src/laguerre.ts
  - origin: mapped
    form: wolfram / mpmath / sympy
    environment: external
    note: LaguerreL[n, x] and LaguerreL[n, a, x]; mpmath.laguerre(n, a, x); sympy.assoc_laguerre(n, a, x).
seeAlso:
  - HermiteH
  - ChebyshevT
  - LegendrePolynomial
  - LaplaceTransform
references:
  - system: wikipedia
    identity: Laguerre polynomials
  - system: mathworld
    identity: LaguerrePolynomial
  - system: dlmf
    identity: "18.3"
names:
  wolframIdentity: true
---

- $L_0^{(a)} = 1$, $L_1^{(a)}(x) = 1 + a - x$, and $(k+1)\,L_{k+1}^{(a)}(x) = (2k+1+a-x)\,L_k^{(a)}(x) - (k+a)\,L_{k-1}^{(a)}(x)$. The two-argument $L_n(x)$ is $L_n^{(0)}(x)$.
- $L_n^{(a)}(x) = \sum_{k=0}^{n} (-1)^k \binom{n+a}{n-k} \dfrac{x^k}{k!}$, a polynomial in $x$ of degree $n$ whose leading coefficient is $(-1)^n / n!$.
- $\dfrac{d}{dx} L_n^{(a)}(x) = -L_{n-1}^{(a+1)}(x)$, so `D(LaguerreL(n, x), x)` is $-L_{n-1}^{(1)}(x)$ at a symbolic order too.
- $L_n(0) = 1$, and $L_n^{(a)}(0) = \binom{n+a}{n}$.
- $\int_0^\infty e^{-x} L_m(x)\,L_n(x)\,dx = \delta_{mn}$.
- At an integer $n$ and a symbolic or exact $x$ the result is the explicit sum, so a symbolic $a$ stays symbolic. At a floating-point or complex $x$ and a numeric $a$ the recurrence runs directly on the number, and the head stays unevaluated if it overflows the double range.
- A symbolic or negative order stays unevaluated, and so does a non-integer one. Wolfram continues $L_\nu^{(a)}$ to those orders through the confluent hypergeometric $_1F_1$, which is not implemented here.
