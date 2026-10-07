---
name: RiemannSiegelZ
domain: Special functions
signature: RiemannSiegelZ(t)
summary: The Riemann–Siegel function $Z(t) = e^{i\vartheta(t)}\zeta(\tfrac12 + it)$, real-valued for real $t$ by construction. Provided by `@enumeratio/analytic`.
signatures:
  - call: RiemannSiegelZ(t)
    description: the Riemann–Siegel Z-function.
    library: "@enumeratio/analytic"
    type: (number) -> number
primitive: numeric
bindings:
  - origin: native
    form: typescript
    environment: engine
    source: packages/symbols/analysis/analytic/src/riemann-siegel.ts
  - origin: mapped
    form: wolfram / mpmath
    environment: external
    note: RiemannSiegelZ[t]; mpmath.siegelz(t).
seeAlso:
  - RiemannSiegelTheta
  - Zeta
  - RiemannZetaZero
names:
  wolframIdentity: true
---

- Reuses [[RiemannSiegelTheta]] and the generalized-zeta kernel ([[Zeta]]/[[HurwitzZeta]] at $a=1$); only the phase rotation onto the real line is added.
- Numeric via `N()` or an inexact $t$, same as [[RiemannSiegelTheta]]. `N(…, d)` past a double's digits runs the bignum Hurwitz zeta and log-gamma kernels (real $t$ up to $10^5$, complex up to $2\cdot10^4$), carrying each part to $d$ digits.
- The sign of $Z$ on the real line is what [[RiemannZetaZero]]'s zero-finder scans for.
