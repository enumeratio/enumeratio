---
name: HermiteH
domain: Special functions
signature: HermiteH(n, x)
summary: The physicists' Hermite polynomial $H_n(x)$, orthogonal on the real line with weight $e^{-x^2}$. Provided by `@enumeratio/analytic`.
signatures:
  - call: HermiteH(n, x)
    description: the degree-$n$ Hermite polynomial at $x$, for an integer $n \ge 0$.
    library: "@enumeratio/analytic"
    type: (number, number) -> number
bindings:
  - origin: reference
    form: notatio
    environment: engine
    expr:
      [
        Multiply,
        [Factorial, _n],
        [
          Sum,
          [
            Divide,
            [Multiply, [Power, -1, m], [Power, [Multiply, 2, _x], [Subtract, _n, [Multiply, 2, m]]]],
            [Multiply, [Factorial, m], [Factorial, [Subtract, _n, [Multiply, 2, m]]]],
          ],
          [Triple, m, 0, [Floor, [Divide, _n, 2]]],
        ],
      ]
    note: The explicit sum over $m$ up to $\lfloor n/2 \rfloor$; the kernel runs the three-term recurrence instead, and the two are checked against each other.
  - origin: native
    form: typescript
    environment: engine
    source: packages/symbols/analysis/analytic/src/hermite.ts
  - origin: mapped
    form: wolfram / mpmath / sympy
    environment: external
    note: HermiteH[n, x]; mpmath.hermite(n, x); sympy.hermite(n, x).
seeAlso:
  - ChebyshevT
  - LegendrePolynomial
  - LaplaceTransform
references:
  - system: wikipedia
    identity: Hermite polynomials
  - system: mathworld
    identity: HermitePolynomial
  - system: dlmf
    identity: "18.3"
names:
  wolframIdentity: true
---

- $H_0 = 1$, $H_1 = 2x$, and $H_{n+1} = 2x\,H_n - 2n\,H_{n-1}$. The coefficients are integers and the leading one is $2^n$.
- $H_n' = 2n\,H_{n-1}$, so `D(HermiteH(n, x), x)` is $2n\,H_{n-1}(x)$ at a symbolic order too.
- $\int_{-\infty}^{\infty} H_m(x)\,H_n(x)\,e^{-x^2}\,dx = 2^n\,n!\,\sqrt\pi\,\delta_{mn}$.
- Parity follows the degree: $H_n(-x) = (-1)^n H_n(x)$, and $H_{2k}(0) = (-1)^k (2k)!/k!$.
- At an integer $n$ and a symbolic or exact $x$ the result is the expanded polynomial. At a floating-point or complex $x$ the recurrence runs directly on the number, and the head stays unevaluated if it overflows the double range.
- A symbolic order stays unevaluated. Wolfram continues $H_\nu$ to negative and non-integer $\nu$ through confluent hypergeometric functions, and that is not implemented here; those orders also stay unevaluated.
