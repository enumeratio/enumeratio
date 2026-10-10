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
- Numeric via `N()` or an inexact $t$, same as [[RiemannSiegelTheta]]. Below $|{\rm Re}\,t| \approx 100$ (real $t$: 2000) it runs the Hurwitz zeta and log-gamma kernels; past that, the Riemann–Siegel formula with Gabcke's remainder terms ($C_0$ to $C_{30}$), continued to complex $t$ with $|{\rm Im}\,t| \le \tfrac12\sqrt{|{\rm Re}\,t|}$ and carried in BigDecimal for the phase, which a double loses with $t$. That is a double's digits for any $|{\rm Re}\,t|$ up to $10^{10}$, where the zeta sum's phases lose a relative $10^{-9}$ by $t = 10^6$.
- `N(…, d)` past a double's digits uses the same formula as far as its terms reach (its series is asymptotic): about 60 digits at $t = 2\cdot10^4$, 70 at $10^5$, 90 at $10^6$. Below that it falls back to the bignum Hurwitz zeta and log-gamma kernels (real $t$ up to $10^5$, complex up to $2\cdot10^4$), and past both it stays unevaluated rather than print fewer digits than were asked. `N`'s refinement loop reads the value at 20 to 40 digits past $d$, so $d$ is that much less than these.
- The sign of $Z$ on the real line is what [[RiemannZetaZero]]'s zero-finder scans for.
