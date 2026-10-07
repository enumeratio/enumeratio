---
name: Hypergeometric3F2Regularized
domain: Special functions
signature: Hypergeometric3F2Regularized(a1, a2, a3, b1, b2, z)
summary: The regularized generalized hypergeometric function ${}_3F_2(a_1,a_2,a_3;b_1,b_2;z) / (\Gamma(b_1)\Gamma(b_2))$ — entire in $b_1, b_2$; only converges for $|z| < 1$. Provided by `@enumeratio/analytic`.
signatures:
  - call: Hypergeometric3F2Regularized(a1, a2, a3, b1, b2, z)
    description: ${}_3F_2(a_1,a_2,a_3;b_1,b_2;z) / (\Gamma(b_1)\Gamma(b_2))$.
    library: "@enumeratio/analytic"
    type: (number, number, number, number, number, number) -> number
primitive: numeric
bindings:
  - origin: native
    form: typescript
    environment: engine
    source: packages/symbols/analysis/analytic/src/hypergeometric.ts
  - origin: mapped
    form: wolfram / mpmath
    environment: external
    note: HypergeometricPFQRegularized[{a1,a2,a3},{b1,b2},z]; mpmath's own regularized series (rgamma per term).
seeAlso:
  - Hypergeometric2F1Regularized
---

- compute-engine has no `Hypergeometric3F2` at all, regularized or otherwise. Computed directly by the $1/\Gamma$-per-term series ($p = q + 1$ here), finite at either $b_1$ or $b_2$ a nonpositive integer.
- The series only converges for $|z| < 1$; outside the unit disc this stays symbolic. `N(…, d)` past a double's digits runs a bignum series for real arguments with $|z| < 1$ (the cancellation at negative $z$ is paid for in extra working digits), and stays symbolic rather than padding a double where it can't settle: a complex $z$, $|z| \ge 1$, or $z$ so near the rim that the series outruns its term budget. Fungrim's own identities for this head (e.g. the Chebyshev derivative formulas, fungrim:6582c4 / fungrim:e1797b) are unconstrained in their own argument, so not every instance evaluates.
- Wolfram has no dedicated 3,2 head; it maps to the generic `HypergeometricPFQRegularized[{a1,a2,a3},{b1,b2},z]`.
