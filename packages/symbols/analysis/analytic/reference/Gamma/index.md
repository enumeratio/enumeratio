---
name: Gamma
domain: Special functions
signature: Gamma(z)
summary: The gamma function $\Gamma(z)$, extending the factorial to real and complex arguments; with two arguments, the upper incomplete gamma function.
signatures:
  - call: Gamma(z)
    description: the gamma function $\Gamma(z)$.
  - call: Gamma(s, z)
    description: the upper incomplete gamma function $\Gamma(s, z) = \int_z^\infty t^{s-1} e^{-t}\,dt$.
  - call: Gamma(s, z0, z1)
    description: the generalized incomplete gamma $\Gamma(s, z_0) - \Gamma(s, z_1) = \int_{z_0}^{z_1} t^{s-1} e^{-t}\,dt$; at $z_0 = 0$ the LOWER incomplete gamma $\gamma(s, z_1)$.
    library: "@enumeratio/analytic"
    type: (complex | infinity, (complex | infinity)?, (complex | infinity)?) -> number
    overrides: compute-engine
seeAlso:
  - Factorial
  - GammaLn
  - LogGamma
  - GammaRegularized
  - Digamma
  - Beta
references:
  - system: wikipedia
    identity: Gamma function
  - system: mathworld
    identity: GammaFunction
  - system: dlmf
    identity: "5"
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: wolfram
    template: Gamma[$1]
    arity: 1
    threadArg: 1
  - origin: mapped
    form: sympy
    template: gamma($1)
    arity: 1
    threadArg: 1
  - origin: mapped
    form: mpmath
    template: gamma($1)
    arity: 1
    threadArg: 1
  - origin: mapped
    form: sage
    template: gamma($1)
    arity: 1
    threadArg: 1
  - origin: mapped
    form: rust
    template: gamma($1)
    arity: 1
    threadArg: 1
  - origin: mapped
    form: sympy
    template: uppergamma($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.14.0
      on: 2026-10-14
  - origin: mapped
    form: sympy
    template: (uppergamma($1, $2) - uppergamma($1, $3))
    arity: 3
    threadArgOnly:
      - 1
      - 2
      - 3
    checked:
      version: 1.14.0
      on: 2026-10-14
    note: Wolfram's generalized incomplete gamma is the difference of two upper incomplete gammas, written out; at z0 = 0 it is the lower incomplete gamma.
  - origin: mapped
    form: mpmath
    template: gammainc($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: mpmath
    template: gammainc($1, $2, $3)
    arity: 3
    threadArgOnly:
      - 1
      - 2
      - 3
    note: The incomplete gamma from z0 to z1, the difference of two upper ones.
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: sage
    template: gamma_inc($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: sage
    template: (gamma_inc($1, $2) - gamma_inc($1, $3))
    arity: 3
    threadArgOnly:
      - 1
      - 2
      - 3
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: julia
    template: enumeratio_ball(gamma, $1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
  - origin: mapped
    form: julia
    template: enumeratio_ball(gamma, $1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
  - origin: mapped
    form: julia
    template: enumeratio_ball((a, z0, z1) -> gamma(a, z0) - gamma(a, z1), $1, $2, $3)
    arity: 3
    threadArgOnly:
      - 1
      - 2
      - 3
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
  - origin: mapped
    form: rust
    template: upper_gamma($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    note: a, z > 0 only.
    checked:
      version: statrs 0.18.0
      on: 2026-10-16
---

The gamma function $\Gamma(z) = \int_0^\infty t^{z-1} e^{-t}\,dt$ for $\operatorname{Re}(z) > 0$ (DLMF 5.2.1), continued analytically elsewhere, is the standard extension of the factorial to real and complex arguments. The two- and three-argument forms below split that same integral at a finite endpoint rather than $\infty$.

- Extends the factorial: $\Gamma(n) = (n-1)!$ for positive integers n, so [[Factorial]] is $\Gamma(n+1)$.
- Functional equation: $\Gamma(z+1) = z\,\Gamma(z)$.
- Reflection formula: $\Gamma(z)\,\Gamma(1-z) = \dfrac{\pi}{\sin(\pi z)}$, linking $\Gamma$ at z and $1-z$.
- Poles at the nonpositive integers $0, -1, -2, \ldots$, where $\Gamma$ diverges to ComplexInfinity.
- $\Gamma(1/2) = \sqrt{\pi}$, the constant behind the normal distribution's normalizing factor. See [[Erf]].
- compute-engine's plain evaluation would otherwise leave Gamma at exact integer or rational arguments unevaluated (`@enumeratio/analytic` overrides it, reducing every integer and half-integer exactly); a floating-point argument, or N(), still reduces to a decimal.
- The three-argument form (`@enumeratio/analytic`) is Wolfram's generalized incomplete gamma, the integral between two limits: $\Gamma(s, z_0, z_1) = \Gamma(s, z_0) - \Gamma(s, z_1)$. It is the only spelling here for the LOWER incomplete gamma $\gamma(s, z) = \Gamma(s, 0, z)$, which is what the Gamma-distribution CDF and the $\chi^2$ CDF are built from. See [[GammaRegularized]] for the normalized version.
- $\Gamma(1, z) = e^{-z}$, also supplied by `@enumeratio/analytic` -- exact and valid for symbolic $z$, which is what makes $\Gamma(1, 0, z)$ collapse to $1 - e^{-z}$ as Wolfram's does.
- Differs from Wolfram: $Gamma(1/2, x)$ reduces to $\sqrt\pi\,\mathrm{erfc}(\sqrt x)$ on evaluation; Wolfram keeps `Gamma[1/2, x]` until `FunctionExpand`. Both agree as identities.
