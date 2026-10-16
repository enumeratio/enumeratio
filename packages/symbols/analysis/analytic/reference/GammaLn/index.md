---
name: GammaLn
domain: Special functions
signature: GammaLn(z)
summary: The natural logarithm of $\Gamma(z)$, avoiding the overflow of computing [[Gamma]] directly for large z.
signatures:
  - call: GammaLn(z)
    description: $\ln \Gamma(z)$, useful where $\Gamma(z)$ itself would overflow.
  - call: GammaLn(z)
    description: The natural logarithm of $\Gamma(z)$, avoiding the overflow of computing [[Gamma]] directly for large z.
    library: enumeratio-analytic
    type: (complex | infinity) -> number
    overrides: compute-engine
seeAlso:
  - Gamma
  - LogGamma
  - Digamma
references:
  - system: wikipedia
    identity: Gamma function
  - system: mathworld
    identity: LogGammaFunction
  - system: dlmf
    identity: "5.2"
names:
  fungrim: LogGamma
  wolfram: LogGamma
bindings:
  - origin: mapped
    form: sympy
    template: loggamma($1)
    arity: 1
    threadArg: 1
    checked:
      version: 1.14.0
      on: 2026-10-14
    note: SymPy's loggamma is the principal continuation, as Wolfram's LogGamma is, so the real log-magnitude GammaLn takes at a negative real differs from it.
  - origin: mapped
    form: mpmath
    template: loggamma($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: julia
    template: enumeratio_ball(lgamma, $1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
---

- Defined via [[Gamma]]: $\operatorname{GammaLn}(z) = \ln \Gamma(z)$ for $z > 0$, where $\Gamma$ is positive so no branch-cut ambiguity arises.
- Called gammaln in MATLAB and SciPy, lgamma in C's math library.
- Inherits Gamma's recurrence in log form: $\operatorname{GammaLn}(z+1) = \operatorname{GammaLn}(z) + \ln z$.
- $\operatorname{GammaLn}(1/2) = \frac{1}{2}\ln \pi$, from $\Gamma(1/2) = \sqrt{\pi}$.
- Diverges to $+\infty$ at the nonpositive integers, the poles of Gamma -- the log of a diverging magnitude, rather than the ComplexInfinity that [[Gamma]] itself returns there.
- GammaLn is the real log-magnitude, not the complex log: for real $z<0$ it is $\ln|\Gamma(z)|$, so $\operatorname{GammaLn}(-0.5) = \ln(2\sqrt\pi) \approx 1.2655$ with no imaginary part, though $\Gamma(-0.5) = -2\sqrt\pi < 0$. [[LogGamma]] is the principal continuation, $\ln\Gamma(z)$ analytic off $(-\infty, 0]$: $\operatorname{LogGamma}(-0.5) \approx 1.2655 - \pi i$ (Wolfram's `LogGamma[-0.5]` and mpmath's `loggamma(-0.5)`, both $1.2655 - 3.1416i$; the principal logarithm of the negative real $\Gamma(-0.5)$ itself would be $+\pi i$, so it is a third value). Use GammaLn for the magnitude of a real gamma ratio, LogGamma where continuity in $z$ matters.
- For complex $z$ it is $\ln(\Gamma(z))$ with a PRINCIPAL logarithm, which is not Wolfram's $\mathrm{LogGamma}$: the two differ by multiples of $2\pi i$ off the positive axis.
