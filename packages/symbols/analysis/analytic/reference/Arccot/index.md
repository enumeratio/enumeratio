---
name: Arccot
domain: Elementary functions
signature: Arccot(x)
summary: Arccotangent, the inverse of [[Cot]].
signatures:
  - call: Arccot(x)
    description: the value $y$ with $\cot(y) = x$.
  - call: Arccot(x)
    description: Arccotangent, the inverse of [[Cot]].
    library: enumeratio-analytic
    type: (complex | signed_infinity) -> number
    overrides: compute-engine
seeAlso:
  - Cot
  - Arctan
names:
  fungrim: Acot
bindings:
  - origin: mapped
    form: sympy
    template: acot($1)
    arity: 1
    threadArg: 1
    checked:
      version: 1.14.0
      on: 2026-10-14
    note: SymPy's acot ranges over (-pi/2, pi/2], as Wolfram's ArcCot does; compute-engine's Arccot ranges over (0, pi).
  - origin: mapped
    form: mpmath
    template: acot($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: julia
    template: enumeratio_ball(_acot, $1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
---

- Stays symbolic even at values where the reciprocal circular functions fold exactly (e.g. $x = 1$) -- wrap in N(...) for a numeric result.
- Differs from Wolfram: the range is $(0, \pi)$, so $Arccot(-1) = 3\pi/4$; Wolfram's `ArcCot` ranges over $[-\pi/2, \pi/2]$ and gives $-\pi/4$.
