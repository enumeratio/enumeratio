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
- compute-engine leaves x outside $[0, 1]$ symbolic rather than erroring or returning NaN.
