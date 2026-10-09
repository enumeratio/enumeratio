---
name: LaplaceTransform
domain: Transforms
signature: LaplaceTransform(f, t, s)
summary: The one-sided Laplace transform $F(s) = \int_0^\infty f(t) e^{-st}\,dt$, as a rule table over the standard pairs (powers, exponentials, trig/hyperbolic, the unit step, the impulse) plus linearity and the first shifting theorem.
signatures:
  - call: LaplaceTransform(f, t, s)
    description: $F(s) = \int_0^\infty f(t) e^{-st}\,dt$, for `f` a function of `t`.
    library: "@enumeratio/analytic"
    type: (expression, expression, expression) -> expression
primitive: kernel
bindings:
  - origin: native
    form: typescript
    environment: engine
    source: packages/symbols/analysis/analytic/src/transforms.ts
seeAlso:
  - InverseLaplaceTransform
  - FourierTransform
names:
  wolframIdentity: true
---

- Covered: $t^n$ ($n$ a concrete real $> -1$), $e^{at}$, $\sin(at)$, $\cos(at)$, $\sinh(at)$, $\cosh(at)$, `UnitStep(t - a)` and `DiracDelta(t - a)` (sign of `a` determined via `isPositive`/`isNegative`, declined if unknown), sums (linearity), a constant factor, and the first shifting theorem — an `Exp(a t)` factor multiplying an otherwise-transformable piece shifts $s \to s - a$ in that piece's transform, covering $t^n e^{at}$, $e^{at}\sin(bt)$, etc.
- Also covered: $|\sin at|$ and $|\cos at|$ (the full-wave rectified waves, $a\coth(\pi s/2a)/(s^2+a^2)$ and $(s+a\,\mathrm{csch}(\pi s/2a))/(s^2+a^2)$), $\Gamma(\nu,a/t)\to 2(as)^{\nu/2}K_\nu(2\sqrt{as})/s$ for a provably positive `a`, and the multivariate `LaplaceTransform(f, {t1, t2}, {s1, s2})` of a function that separates into one-variable factors, or otherwise one variable at a time.
- Also covered: $\sin(c\sqrt t)\to c\sqrt\pi\,e^{-c^2/4s}/(2s^{3/2})$, $\cos(c\sqrt t)/\sqrt t\to\sqrt{\pi/s}\,e^{-c^2/4s}$, and the Fresnel integrals $C(c\sqrt t)$, $S(c\sqrt t)$ (closed forms in $\sqrt{a^2+s^2}$, $a=\pi c^2/2$). That last one is what makes $\cos(\sqrt{xy})/\sqrt{xy}$, which does not separate, transform to $\pi/\sqrt{p(q+1/4p)}$.
- Also covered: $t^{-1/2}(1+t)^n\,T_n\!\left(\tfrac{1-t}{1+t}\right)\to\sqrt\pi\,s^{-n-1/2}H_{2n}(\sqrt s)/4^n$, for the same symbolic $n$ on the power and the order ([[ChebyshevT]], [[HermiteH]]).
- Declined: an opaque function `f(t)` (Wolfram itself only expands the derivative/second-shifting theorems symbolically, which would mean synthesizing `f(0)` or a self-referential `LaplaceTransform[f[t],t,s]` for an arbitrary `f`); a product of two independently-transformable pieces outside the shifting-theorem shape (e.g. $t^2 \sin(t)$); `UnitStep`/`DiracDelta` at $a = 0$ or an undetermined-sign `a`; any exponent not linear in `t`.
