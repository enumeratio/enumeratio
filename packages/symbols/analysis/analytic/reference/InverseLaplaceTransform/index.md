---
name: InverseLaplaceTransform
domain: Transforms
signature: InverseLaplaceTransform(F, s, t)
summary: The inverse Laplace transform, as a small dictionary of common images ($s^{-n}$, $1/(s-a)$, $s/(s^2 \pm a^2)$, $a/(s^2 \pm a^2)$) plus linearity — not a general residue calculus.
signatures:
  - call: InverseLaplaceTransform(F, s, t)
    description: $f(t)$ such that $\mathcal{L}\{f\}(s) = F(s)$, read off a fixed table of images.
    library: "@enumeratio/analytic"
    type: (expression, expression, expression) -> expression
primitive: kernel
bindings:
  - origin: native
    form: typescript
    environment: engine
    source: packages/symbols/analysis/analytic/src/transforms.ts
seeAlso:
  - LaplaceTransform
  - InverseFourierTransform
names:
  wolframIdentity: true
---

- Covered: $s^{-n}$ ($n$ a positive integer) $\to t^{n-1}/(n-1)!$; $1/(s-a) \to e^{at}$; $s/(s^2+a^2) \to \cos(at)$; $a/(s^2+a^2) \to \sin(at)$; $s/(s^2-a^2) \to \cosh(at)$; $a/(s^2-a^2) \to \sinh(at)$; sums and a constant factor.
- Also, from the usual tables (each confirmed against `wolframscript`): $s^{-\nu}\to t^{\nu-1}/\Gamma(\nu)$ for a non-whole $\nu>0$ and its first two $\nu$-derivatives (a factor $\ln(cs)$ or $\ln^2(cs)$, $c>0$); the shifting theorems ($e^{-cs}F\to f(t-c)\,\theta(t-c)$, and $F(s-a)\to e^{at}f(t)$ when a $\sqrt{s-a}$ appears, once); $1/((s-a)\sqrt s)\to e^{at}\operatorname{erf}(\sqrt{at})/\sqrt a$ and $\sqrt s/(s-a)$; $\ln s/(s-a)\to e^{at}(\ln a-\mathrm{Ei}(-at))$ for a concrete $a>0$; $\Gamma(\nu,s)/s^\nu\to t^{\nu-1}\theta(t-1)$; $\operatorname{erf}(\sqrt{as})/\sqrt s\to\theta(a-t)/\sqrt{\pi t}$ for $a>0$; and the elliptic pairs $K(a^2/s^2)-\pi/2$ and $s(\pi/2-E(a^2/s^2))$, both Bessel $I_0I_1$ products.
- Declined: anything outside those — a general rational function of `s` (partial-fraction decomposition is not attempted), a non-positive power of `s`, a bare logarithm, an image that doesn't depend on `s` at all.
