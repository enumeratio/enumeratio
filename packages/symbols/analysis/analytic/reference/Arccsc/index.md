---
name: Arccsc
domain: Elementary functions
signature: Arccsc(x)
summary: Arccosecant, the inverse of [[Csc]].
signatures:
  - call: Arccsc(x)
    description: the value $y$ with $\csc(y) = x$.
  - call: Arccsc(x)
    description: Arccosecant, the inverse of [[Csc]].
    library: enumeratio-analytic
    type: (complex | infinity | quantity) -> number
    overrides: compute-engine
seeAlso:
  - Csc
  - Arcsin
names:
  wolfram: ArcCsc
bindings:
  - origin: mapped
    form: sympy
    template: acsc($1)
    arity: 1
    threadArg: 1
    checked:
      version: 1.14.0
      on: 2026-10-14
  - origin: mapped
    form: mpmath
    template: acsc($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: sage
    template: arccsc($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: julia
    template: enumeratio_ball(_acsc, $1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
  - origin: mapped
    form: rust
    template: asin(n(1) / $1)
    arity: 1
    threadArgOnly: 1
    note: asin of the reciprocal, the principal value off 0.
    checked:
      version: rustc 1.98.1
      on: 2026-10-16
---

- Differs from Wolfram: past its real domain a rational argument reduces to the exact principal value, on every inverse trigonometric and hyperbolic head alike ([[Arcsin]], [[Arccos]], [[Arcsec]], [[Arccsc]], [[Arcosh]], [[Artanh]], [[Arcoth]], [[Arsech]]); Wolfram leaves the exact call unevaluated and gives the same number from `N[...]`. Checked against mpmath and `wolframscript` on a grid of rationals to double precision. A float and `N(...)` already took the same branch. Compiled code is separate: the JavaScript target is real-valued (NaN past the domain), the WGSL target returns a complex pair, and Arcsin and Arccos decline to compile. For $0<|x|<1$, $\operatorname{arccsc}(x) = \arcsin(1/x)$, so $\operatorname{arccsc}(1/2) = \frac{\pi}{2} - i\ln(2+\sqrt3)$ (mpmath `acsc(0.5)`).
