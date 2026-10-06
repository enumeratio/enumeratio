---
name: Arccos
domain: Elementary functions
signature: Arccos(x)
summary: Arccosine, the inverse of [[Cos]] restricted to $[0, \pi]$.
signatures:
  - call: Arccos(x)
    description: the principal value $y \in [0, \pi]$ with $\cos(y) = x$.
  - call: Arccos(x)
    description: Arccosine, the inverse of [[Cos]] restricted to $[0, \pi]$.
    library: enumeratio-analytic
    type: (complex) -> number
    overrides: compute-engine
seeAlso:
  - Cos
  - Arcsin
  - Arctan
references:
  - system: wikipedia
    identity: Inverse trigonometric functions
  - system: mathworld
    identity: InverseCosine
  - system: dlmf
    identity: "4.23"
names:
  fungrim: Acos
  dlmf: arccosine function
  wolfram: ArcCos
---

- Real-valued only for $x \in [-1, 1]$; outside that range the result is complex.
- Co-function with [[Arcsin]]: $\arccos(x) = \pi/2 - \arcsin(x)$.
- Undoes [[Cos]] on its principal branch: $\cos(\arccos(x)) = x$ for $x \in [-1, 1]$.
- Differs from Wolfram: past its real domain a rational argument reduces to the exact principal value, on every inverse trigonometric and hyperbolic head alike ([[Arcsin]], [[Arccos]], [[Arcsec]], [[Arccsc]], [[Arcosh]], [[Artanh]], [[Arcoth]], [[Arsech]]); Wolfram leaves the exact call unevaluated and gives the same number from `N[...]`. Checked against mpmath and `wolframscript` on a grid of rationals to double precision. A float and `N(...)` already took the same branch. Compiled code is separate: the JavaScript target is real-valued (NaN past the domain), the WGSL target returns a complex pair, and Arcsin and Arccos decline to compile. Principal branch, same cuts as [[Arcsin]]: for $x>1$, $\arccos(x) = i\ln(x+\sqrt{x^2-1})$ (mpmath `acos(2)` is $1.317i$), and for $x<-1$, $\pi - i\ln(|x|+\sqrt{x^2-1})$.
