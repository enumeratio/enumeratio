---
name: Arcoth
domain: Elementary functions
signature: Arcoth(x)
summary: Inverse hyperbolic cotangent, the inverse of Coth.
signatures:
  - call: Arcoth(x)
    description: the value $y$ with $\coth(y) = x$.
  - call: Arcoth(x)
    description: Inverse hyperbolic cotangent, the inverse of Coth.
    library: enumeratio-analytic
    type: (complex | infinity) -> number
    overrides: compute-engine
seeAlso:
  - Artanh
names:
  wolfram: ArcCoth
---

- Stays symbolic at plain evaluation, same as [[Arsinh]]-family functions; wrap in N(...).
- Differs from Wolfram: past its real domain a rational argument reduces to the exact principal value, on every inverse trigonometric and hyperbolic head alike ([[Arcsin]], [[Arccos]], [[Arcsec]], [[Arccsc]], [[Arcosh]], [[Artanh]], [[Arcoth]], [[Arsech]]); Wolfram leaves the exact call unevaluated and gives the same number from `N[...]`. Checked against mpmath and `wolframscript` on a grid of rationals to double precision. A float and `N(...)` already took the same branch. Compiled code is separate: the JavaScript target is real-valued (NaN past the domain), the WGSL target returns a complex pair, and Arcsin and Arccos decline to compile. For $0<|x|<1$, $\operatorname{arcoth}(x) = \operatorname{sign}(x)\left(\tfrac12\ln\frac{1+|x|}{1-|x|} - \tfrac{i\pi}{2}\right)$, which is $\operatorname{artanh}(1/x)$ (mpmath `acoth(0.5)`).
