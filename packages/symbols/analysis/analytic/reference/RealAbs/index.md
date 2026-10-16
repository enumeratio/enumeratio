---
name: RealAbs
domain: Elementary functions
signature: RealAbs(x)
summary: The absolute value of a real number x, as a function defined only on the reals.
signatures:
  - call: RealAbs(x)
    description: the absolute value of the real number x.
    library: "@enumeratio/analytic"
    type: (number) -> number
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: julia
    template: enumeratio_ball(abs, $1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
---

- Agrees with native [[Abs]] on every real x -- RealAbs exists so a plot or a domain check can say "real only" and mean it, the way Wolfram's does.
- A concretely complex argument is outside RealAbs's domain and is left unevaluated -- unlike [[Abs]], which is complex-valued (the modulus).
