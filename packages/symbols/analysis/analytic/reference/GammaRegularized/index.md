---
name: GammaRegularized
domain: Special functions
signature: GammaRegularized(a, z)
summary: The regularized upper incomplete gamma function $Q(a, z) = \Gamma(a, z)/\Gamma(a)$, the survival function of the Gamma(a, 1) distribution.
signatures:
  - call: GammaRegularized(a, z)
    description: the regularized upper incomplete gamma $Q(a, z) = \Gamma(a, z)/\Gamma(a)$.
  - call: GammaRegularized(a, z0, z1)
    description: the regularized difference $(\Gamma(a, z_0) - \Gamma(a, z_1))/\Gamma(a)$; at $z_0 = 0$ the LOWER regularized $P(a, z_1) = 1 - Q(a, z_1)$.
    library: "@enumeratio/analytic"
    type: (complex | infinity, complex | infinity, (complex | infinity)?) -> number
    overrides: compute-engine
seeAlso:
  - Gamma
  - BetaRegularized
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sympy
    template: (uppergamma($1, $2) / gamma($1))
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.14.0
      on: 2026-10-14
    note: SymPy has no regularized incomplete gamma; it is written out as its definition, Gamma(a, z) / Gamma(a).
  - origin: mapped
    form: sage
    template: (gamma_inc($1, $2) / gamma($1))
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: "10.9"
      on: 2026-10-16
---

- Complementary to the lower regularized $P(a, z) = 1 - Q(a, z)$, which is the three-argument $Q(a, 0, z)$ (`@enumeratio/analytic`) -- the Gamma-distribution CDF, and with $a = k/2$, $z = x/2$ the $\chi^2_k$ CDF.
- $Q(a, 0) = 1$ for any $a > 0$: all the mass sits to the right of 0.
- For a positive integer n it has a closed polynomial form, $Q(n, z) = e^{-z}\sum_{k=0}^{n-1} z^k/k!$, which compute-engine uses to evaluate exactly, even for negative z.
- Gives the Poisson CDF tail and the Gamma-distribution survival function, so it shows up throughout reliability and queueing models. See [[Gamma]].
- The three-argument form divides the difference by $\Gamma(a)$ rather than subtracting two $Q$ values, so $Q(a, 0, z) = 1 - Q(a, z)$ holds for negative $a$ too, where $\Gamma(a, 0)$ and $\Gamma(a)$ are separately infinite but their ratio is 1. That is Wolfram's convention.
- A genuinely complex $a$ or $z$, which the built-in handler declines, is evaluated as $\Gamma(a, z)/\Gamma(a)$ (`@enumeratio/analytic`) -- [[Gamma]] itself takes complex arguments. So is a non-integer real $a$ with $z < 0$, whose value is complex (principal branch, $\ln z = \ln|z| + i\pi$): $Q(5/2, -1) = 1 - 0.628\,i$. Computed in doubles from $Q = 1 - R\,e^{i\pi a}$ with a positive series for $R$; it stays unevaluated past what doubles hold, and where $\operatorname{Re} Q$ would lose digits to cancellation (an order near an even integer or near 0).
