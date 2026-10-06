---
name: Arcosh
domain: Compute engine
signature: Arcosh(complex | signed_infinity) -> number
summary: Inverse hyperbolic cosine (area hyperbolic cosine).
signatures:
  - call: Arcosh(complex | signed_infinity) -> number
    description: as compute-engine declares it
  - call: Arcosh(complex | signed_infinity | ~oo) -> number | signed_infinity | ~oo
    description: Inverse hyperbolic cosine (area hyperbolic cosine).
    library: enumeratio-analytic
    type: (complex | signed_infinity) -> number
    overrides: compute-engine
names:
  fungrim: Acosh
  dlmf: inverse hyperbolic cosine function
  wolfram: ArcCosh
stub: engine
---

- Differs from Wolfram: past its real domain a rational argument reduces to the exact principal value, on every inverse trigonometric and hyperbolic head alike ([[Arcsin]], [[Arccos]], [[Arcsec]], [[Arccsc]], [[Arcosh]], [[Artanh]], [[Arcoth]], [[Arsech]]); Wolfram leaves the exact call unevaluated and gives the same number from `N[...]`. Checked against mpmath and `wolframscript` on a grid of rationals to double precision. A float and `N(...)` already took the same branch. Compiled code is separate: the JavaScript target is real-valued (NaN past the domain), the WGSL target returns a complex pair, and Arcsin and Arccos decline to compile. Principal branch, cut on $(-\infty, 1)$, continuous from above: for $x<-1$, $\ln(|x|+\sqrt{x^2-1}) + i\pi$ (mpmath `acosh(-2)`), and for $|x|<1$, $i\arccos(x)$.
