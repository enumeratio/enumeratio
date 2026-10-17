---
name: InverseBetaRegularized
domain: Special functions
signature: InverseBetaRegularized(s, a, b)
summary: "The inverse of the regularized incomplete beta $I_x(a, b)$ in $x$: the Beta-distribution quantile. Solved the same way as [[InverseGammaRegularized]] — a safeguarded Newton's method against native `BetaRegularized`."
signatures:
  - call: InverseBetaRegularized(s, a, b)
    description: solves $s = I_x(a, b)$ for $x$.
    library: "@enumeratio/analytic"
    type: (number, number, number) -> number
primitive: kernel
bindings:
  - origin: native
    form: typescript
    environment: engine
    source: packages/symbols/analysis/analytic/src/inverse-regularized.ts
    note: Safeguarded Newton/bisection against native BetaRegularized.
  - origin: mapped
    form: rust
    template: inverse_beta_regularized($2, $3, $1)
    arity: 3
    threadArgOnly:
      - 1
      - 2
      - 3
    checked:
      version: statrs 0.18.0
      on: 2026-10-16
  - origin: mapped
    form: mpmath
    template: enumeratio_inverse_beta_regularized($1, $2, $3)
    arity: 3
    threadArgOnly:
      - 1
      - 2
      - 3
    checked:
      version: mpmath 1.3.0
      on: 2026-10-17
seeAlso:
  - BetaRegularized
  - InverseGammaRegularized
names:
  wolframIdentity: true
---

- $I_x(1, 1) = x$ is its own inverse, and $I_x(a, 1) = x^a$ inverts to $s^{1/a}$ — both exact, symbolic $s$ (and $a$) included.
- Otherwise: a safeguarded Newton's method in $\ln x$ against `BetaRegularized(x, a, b)` (above $s = 1/2$, on the upper tail $I_y(b, a) = 1 - s$), using the Beta density $x^{a-1}(1-x)^{b-1}/B(a,b)$ (in log space) as the derivative; checked against `wolframscript` to 20 digits.
