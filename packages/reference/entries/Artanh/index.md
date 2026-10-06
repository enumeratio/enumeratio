---
name: Artanh
domain: Compute engine
signature: Artanh(complex | signed_infinity) -> number
summary: Inverse hyperbolic tangent (area hyperbolic tangent).
signatures:
  - call: Artanh(complex | signed_infinity) -> number
    description: as compute-engine declares it
  - call: Artanh(complex | signed_infinity | ~oo) -> Indeterminate | number | signed_infinity
    description: Inverse hyperbolic tangent (area hyperbolic tangent).
    library: enumeratio-analytic
    type: (complex | signed_infinity | ~oo) -> number
    overrides: compute-engine
names:
  fungrim: Atanh
  dlmf: inverse hyperbolic tangent function
  wolfram: ArcTanh
stub: engine
---

- Differs from Wolfram: past its real domain a rational argument reduces to the exact principal value, on every inverse trigonometric and hyperbolic head alike ([[Arcsin]], [[Arccos]], [[Arcsec]], [[Arccsc]], [[Arcosh]], [[Artanh]], [[Arcoth]], [[Arsech]]); Wolfram leaves the exact call unevaluated and gives the same number from `N[...]`. Checked against mpmath and `wolframscript` on a grid of rationals to double precision. A float and `N(...)` already took the same branch. Compiled code is separate: the JavaScript target is real-valued (NaN past the domain), the WGSL target returns a complex pair, and Arcsin and Arccos decline to compile. Principal branch, cuts on $(-\infty,-1]$ and $[1,\infty)$: past 1 the value is the limit from below, $\tfrac12\ln\frac{x+1}{x-1} - \tfrac{i\pi}{2}$ (mpmath `atanh(2)`; Wolfram's `ArcTanh[2.]` agrees), and oddness gives the other cut.
