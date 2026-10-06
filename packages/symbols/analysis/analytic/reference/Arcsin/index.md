---
name: Arcsin
domain: Elementary functions
signature: Arcsin(x)
summary: Arcsine, the inverse of [[Sin]] restricted to $[-\pi/2, \pi/2]$.
signatures:
  - call: Arcsin(x)
    description: the principal value $y \in [-\pi/2, \pi/2]$ with $\sin(y) = x$.
  - call: Arcsin(x)
    description: Arcsine, the inverse of [[Sin]] restricted to $[-\pi/2, \pi/2]$.
    library: enumeratio-analytic
    type: (complex) -> number
    overrides: compute-engine
seeAlso:
  - Sin
  - Arccos
  - Arctan
references:
  - system: wikipedia
    identity: Inverse trigonometric functions
  - system: mathworld
    identity: InverseSine
  - system: dlmf
    identity: "4.23"
names:
  fungrim: Asin
  dlmf: arcsine function
  wolfram: ArcSin
---

- Real-valued only for $x \in [-1, 1]$; outside that range the result is complex.
- Odd function: $\arcsin(-x) = -\arcsin(x)$.
- Co-function with [[Arccos]]: $\arcsin(x) + \arccos(x) = \pi/2$.
- Undoes [[Sin]] on its principal branch: $\sin(\arcsin(x)) = x$ for $x \in [-1, 1]$.
- Past $[-1, 1]$, a rational $x$ reduces to the exact closed form $\operatorname{sign}(x)\left(\frac{\pi}{2} - i\ln(|x|+\sqrt{x^2-1})\right)$ (`@enumeratio/analytic`) -- the branch compute-engine's own N(Arcsin(x)) takes.
- Differs from Wolfram: past its real domain a rational argument reduces to the exact principal value, on every inverse trigonometric and hyperbolic head alike ([[Arcsin]], [[Arccos]], [[Arcsec]], [[Arccsc]], [[Arcosh]], [[Artanh]], [[Arcoth]], [[Arsech]]); Wolfram leaves the exact call unevaluated and gives the same number from `N[...]`. Checked against mpmath and `wolframscript` on a grid of rationals to double precision. A float and `N(...)` already took the same branch. Compiled code is separate: the JavaScript target is real-valued (NaN past the domain), the WGSL target returns a complex pair, and Arcsin and Arccos decline to compile. Principal branch, cuts on $(-\infty,-1)$ and $(1,\infty)$: the value on $(1,\infty)$ is the limit from below, so $\arcsin(2) = \frac{\pi}{2} - i\ln(2+\sqrt3)$ (mpmath `asin(2)`), and oddness gives the other cut.
