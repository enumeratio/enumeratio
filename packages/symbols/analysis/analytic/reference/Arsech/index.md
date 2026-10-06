---
name: Arsech
domain: Elementary functions
signature: Arsech(x)
summary: Inverse hyperbolic secant, the inverse of Sech.
signatures:
  - call: Arsech(x)
    description: the value $y$ with $\operatorname{sech}(y) = x$.
  - call: Arsech(x)
    description: Inverse hyperbolic secant, the inverse of Sech.
    library: enumeratio-analytic
    type: (complex | signed_infinity) -> number
    overrides: compute-engine
seeAlso:
  - Arcosh
names:
  wolfram: ArcSech
---

- Differs from Wolfram: past its real domain a rational argument reduces to the exact principal value, on every inverse trigonometric and hyperbolic head alike ([[Arcsin]], [[Arccos]], [[Arcsec]], [[Arccsc]], [[Arcosh]], [[Artanh]], [[Arcoth]], [[Arsech]]); Wolfram leaves the exact call unevaluated and gives the same number from `N[...]`. Checked against mpmath and `wolframscript` on a grid of rationals to double precision. A float and `N(...)` already took the same branch. Compiled code is separate: the JavaScript target is real-valued (NaN past the domain), the WGSL target returns a complex pair, and Arcsin and Arccos decline to compile. For $x<0$, $\operatorname{arsech}(x) = \operatorname{arcosh}(1/x)$ (mpmath `asech(-2)` is $\tfrac{2\pi i}{3}$).
