---
name: BetaRegularized
domain: Special functions
signature: BetaRegularized(x, a, b)
summary: The regularized incomplete beta function $I_x(a, b)$, the CDF of the Beta(a, b) distribution and a bridge to the binomial CDF.
signatures:
  - call: BetaRegularized(x, a, b)
    description: the regularized incomplete beta function $I_x(a, b)$.
  - call: BetaRegularized(x, a, b)
    description: The regularized incomplete beta function $I_x(a, b)$, the CDF of the Beta(a, b) distribution and a bridge to the binomial CDF.
    library: enumeratio-analytic
    type: (number, number, number, number?) -> number
    overrides: compute-engine
seeAlso:
  - Beta
  - GammaRegularized
  - Binomial
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sympy
    template: betainc_regularized($2, $3, 0, $1)
    arity: 3
    threadArgOnly:
      - 1
      - 2
      - 3
    checked:
      version: 1.14.0
      on: 2026-10-14
    note: SymPy's betainc_regularized(a, b, x1, x2) is the integral between two limits, so the lower limit is 0 and the arguments reorder.
---

- Normalized against [[Beta]]: $I_x(a, b)$ is the incomplete beta integral at x, divided by $B(a, b)$, so $I_0(a,b)=0$ and $I_1(a,b)=1$.
- Symmetry: $I_x(a, b) + I_{1-x}(b, a) = 1$.
- Ties to the binomial CDF: for $X \sim \text{Binomial}(n, p)$, $P(X \leq k) = I_{1-p}(n-k, k+1)$.
- By symmetry, $I_{1/2}(a, a) = 1/2$ for any a: a symmetric Beta(a, a) distribution has its median exactly at the midpoint.
- Outside $[0, 1]$ the function continues analytically. At integers $a, b \ge 1$ it is a polynomial in x, the binomial tail $\sum_{j=a}^{n}\binom{n}{j}x^j(1-x)^{n-j}$ with $n = a+b-1$, so a rational x has an exact value ($I_2(2, 3) = 8$, $I_{-1}(2, 3) = 17$) and a float x the value at that double. A real $a > 0$ with integer b past $x = 1$ is summed in doubles. Anything else outside $[0, 1]$ (a non-integer b, where the value is complex) stays unevaluated.
