---
name: Erfi
domain: Compute engine
signature: Erfi(complex | signed_infinity) -> complex | signed_infinity
summary: The imaginary error function $\operatorname{erfi}(z) = -i\operatorname{erf}(iz)$.
signatures:
  - call: Erfi(complex | signed_infinity) -> complex | signed_infinity
    description: as compute-engine declares it
  - call: Erfi(complex | signed_infinity | ~oo) -> Indeterminate | complex | signed_infinity
    description: The imaginary error function $\operatorname{erfi}(z) = -i\operatorname{erf}(iz)$.
    library: enumeratio-analytic
    type: (complex | signed_infinity | ~oo) -> Indeterminate | complex | signed_infinity
    overrides: compute-engine
seeAlso:
  - Erf
  - Erfc
references:
  - system: wikipedia
    identity: Error function
  - system: mathworld
    identity: Erfi
  - system: dlmf
    identity: "7.2"
names:
  dlmf: alternative notation for Dawson's integral
  wolframIdentity: true
---

- Defined as $\operatorname{erfi}(z) = -i\operatorname{erf}(iz)$, real-valued for real $z$ (unlike $\operatorname{erf}(iz)$ itself, which is imaginary). See [[Erf]].
- $\operatorname{erfi}(0) = 0$; $\operatorname{erfi}(\pm\infty) = \pm\infty$, unbounded, unlike $\operatorname{erf}$'s $\pm 1$ saturation.
- Odd: $\operatorname{erfi}(-z) = -\operatorname{erfi}(z)$.
- $\operatorname{erfi}(\widetilde\infty)$, the undirected complex infinity, is Indeterminate: it grows like $\exp(z^2)/z$ off the real axis while diverging along it, the same direction-dependence as [[Erf]] and [[Erfc]] there.
- compute-engine requires an inexact (floating-point) argument to produce a numeric value under plain evaluation, the same convention as [[Erf]].
