---
name: HankelTransform
domain: Transforms
signature: HankelTransform(f, r, s, n)
summary: The order-$n$ Hankel transform $F(s) = \int_0^\infty f(r)\,J_n(sr)\,r\,dr$ ($n=0$ by default), as a rule table over the standard pairs.
signatures:
  - call: HankelTransform(f, r, s)
    description: the order-0 Hankel transform of `f`, $\int_0^\infty f(r)\,J_0(sr)\,r\,dr$.
    library: "@enumeratio/analytic"
    type: (expression, expression, expression, number?) -> expression
  - call: HankelTransform(f, r, s, n)
    description: the order-$n$ Hankel transform.
    library: "@enumeratio/analytic"
primitive: kernel
bindings:
  - origin: native
    form: typescript
    environment: engine
    source: packages/symbols/analysis/analytic/src/hankel-transform.ts
seeAlso:
  - MellinTransform
  - LaplaceTransform
names:
  wolframIdentity: true
---

- Order 0 (each pair, and its strip `Re(a) > 0` where one applies, confirmed against `wolframscript`'s `HankelTransform[..., GenerateConditions -> True]`, matching its normalisation exactly): $e^{-ar}\to a/(a^2+s^2)^{3/2}$, $e^{-ar^2}\to \frac{1}{2a}e^{-s^2/(4a)}$, $1/r\to 1/s$, $1/\sqrt{r^2+a^2}\to e^{-as}/s$.
- Two further orders Wolfram's own examples state explicitly, also covered: order 1's $e^{-ar}\to s/(a^2+s^2)^{3/2}$, and $1/r\to 1/s$ at ANY order `n` (`n > -1/2`, an identity independent of the order).
- Four more order-0 pairs from the tables, each confirmed against `wolframscript`: $\operatorname{erfc}(kr)/r\to\operatorname{erf}(s/2k)/s$ and $E_1(kr)/r\to\operatorname{arsinh}(s/k)/s$ ($k>0$), $(1-e^{-mr})/r^2\to\operatorname{arsinh}(m/s)$ ($m>0$; for $m<0$ the integral diverges, so a symbolic $m$ is declined), and $\ln(1+a^2/r^2)\to 2(1-|a|sK_1(|a|s))/s^2$.
- Two conditionally convergent order-0 pairs that jump at $s=|a|$, confirmed against `wolframscript` (whose `MeijerG` answer agrees on each side) and an oscillatory `NIntegrate`: $\sin(ar)/r\to\operatorname{sgn}(a)/\sqrt{a^2-s^2}$ for $s<|a|$ and $0$ above, and $\cos(ar)/r\to 0$ for $s<|a|$ and $1/\sqrt{s^2-a^2}$ above. A symbolic $s$ stays a `Piecewise`; $s=|a|$ diverges and is held, as Wolfram holds it.
- Declined: any other order for $e^{-ar}$/$e^{-ar^2}$/$1/\sqrt{r^2+a^2}$ (Wolfram's own closed forms there involve `Hypergeometric2F1Regularized`/`Hypergeometric1F1Regularized` — not elementary, not chased), and an unknown-sign `a`.
