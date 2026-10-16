---
name: Erf
domain: Special functions
signature: Erf(z)
summary: The Gauss error function $\operatorname{erf}(z) = \frac{2}{\sqrt\pi}\int_0^z e^{-t^2}\,dt$, the shape behind the normal distribution's CDF.
signatures:
  - call: Erf(z)
    description: the Gauss error function $\operatorname{erf}(z)$.
  - call: Erf(z)
    description: The Gauss error function $\operatorname{erf}(z) = \frac{2}{\sqrt\pi}\int_0^z e^{-t^2}\,dt$, the shape behind the normal distribution's CDF.
    library: enumeratio-analytic
    type: (number, number?) -> number
    overrides: compute-engine
seeAlso:
  - Erfc
  - ErfInv
references:
  - system: wikipedia
    identity: Error function
  - system: mathworld
    identity: Erf
  - system: dlmf
    identity: "7.2"
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sympy
    template: erf($1)
    arity: 1
    threadArg: 1
    checked:
      version: 1.14.0
      on: 2026-10-14
  - origin: mapped
    form: sympy
    template: (erf($2) - erf($1))
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.14.0
      on: 2026-10-14
    note: "SymPy's `erf2(x, y)` is the same difference but stays unevaluated even at float arguments, so the difference is written out: erf(z1) - erf(z0), each term SymPy's own erf."
  - origin: mapped
    form: mpmath
    template: erf($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: mpmath
    template: (erf($2) - erf($1))
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: sage
    template: erf($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: julia
    template: enumeratio_ball(erf, $1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
  - origin: mapped
    form: julia
    template: enumeratio_ball((a, b) -> erf(b) - erf(a), $1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
  - origin: mapped
    form: rust
    template: erf($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: statrs 0.18.0
      on: 2026-10-16
---

- Odd function: $\operatorname{erf}(-z) = -\operatorname{erf}(z)$.
- $\operatorname{erf}(0) = 0$, and $\operatorname{erf}(\pm\infty) = \pm 1$ -- the total (signed) area under the Gaussian.
- Complementary with [[Erfc]]: $\operatorname{erf}(z) + \operatorname{erfc}(z) = 1$.
- Builds the normal CDF: $\Phi(x) = \frac{1}{2}\left(1 + \operatorname{erf}(x/\sqrt{2})\right)$.
- compute-engine requires an inexact (floating-point) argument to produce a numeric value under plain evaluation; an exact integer or rational argument is left symbolic outside the special points 0 and $\pm\infty$.
