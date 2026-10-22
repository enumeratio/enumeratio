---
name: InverseGammaRegularized
domain: Special functions
signature: InverseGammaRegularized(a, s)
summary: "The inverse of the regularized incomplete gamma $Q(a, z)$ in $z$: solves $s = Q(a, z)$. Solved numerically by a safeguarded Newton's method against compute-engine's own `GammaRegularized`, using the Gamma density (in log space) as the derivative."
signatures:
  - call: InverseGammaRegularized(a, s)
    description: solves $s = Q(a, z)$ for $z$.
    library: "@enumeratio/analytic"
    type: (number, number) -> number
primitive: kernel
bindings:
  - origin: native
    form: typescript
    environment: engine
    source: packages/symbols/analysis/analytic/src/inverse-regularized.ts
    note: Safeguarded Newton/bisection against native GammaRegularized.
  - origin: mapped
    form: mpmath
    template: enumeratio_inverse_gamma_regularized($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: mpmath 1.3.0
      on: 2026-10-17
  - origin: mapped
    form: sympy
    counterpart: false
    arity: 2
    checked:
      version: 1.14.0
      on: 2026-10-21
    note: SymPy has no inverse of the regularized incomplete gamma (no `gammaincinv`); `lowergamma`, `uppergamma` and `gammainc` exist but nothing solves for the argument.
seeAlso:
  - GammaRegularized
  - Gamma
  - InverseBetaRegularized
names:
  wolframIdentity: true
---

- $Q(a, 0) = 1$ and $Q(a, \infty) = 0$ hold for any $a$, even a symbolic one, so `InverseGammaRegularized(a, 1) = 0` and `InverseGammaRegularized(a, 0) = \infty` are exact regardless.
- $Q(1, z) = e^{-z}$ inverts exactly to $-\ln s$, symbolic $s$ included.
- Otherwise: a safeguarded Newton's method in $\ln z$ (falls back to bisection whenever a step would leave the bracket) against the forward function — `GammaRegularized(a, z)`, or the continued fraction for $Q$ where $z \ge a + 1$, which keeps its digits in the far tail — whose own accuracy was checked directly against `wolframscript` to 20 digits. A root the double solve cannot vouch for is left unevaluated.
- `N(x, d)` past a double's digits polishes the double answer with Newton's method on the bignum series for $P(a, z)$, for real $a > 0$ and $0 < s < 1$.
