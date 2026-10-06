---
name: Arcsec
domain: Elementary functions
signature: Arcsec(x)
summary: Arcsecant, the inverse of [[Sec]].
signatures:
  - call: Arcsec(x)
    description: the value $y$ with $\sec(y) = x$.
  - call: Arcsec(x)
    description: Arcsecant, the inverse of [[Sec]].
    library: enumeratio-analytic
    type: (complex | infinity) -> number
    overrides: compute-engine
seeAlso:
  - Sec
  - Arccos
names:
  wolfram: ArcSec
---

- Differs from Wolfram: past its real domain a rational argument reduces to the exact principal value, on every inverse trigonometric and hyperbolic head alike ([[Arcsin]], [[Arccos]], [[Arcsec]], [[Arccsc]], [[Arcosh]], [[Artanh]], [[Arcoth]], [[Arsech]]); Wolfram leaves the exact call unevaluated and gives the same number from `N[...]`. Checked against mpmath and `wolframscript` on a grid of rationals to double precision. A float and `N(...)` already took the same branch. Compiled code is separate: the JavaScript target is real-valued (NaN past the domain), the WGSL target returns a complex pair, and Arcsin and Arccos decline to compile. For $0<|x|<1$, $\operatorname{arcsec}(x) = \arccos(1/x)$, so $\operatorname{arcsec}(1/2) = i\ln(2+\sqrt3)$ (mpmath `asec(0.5)`).
