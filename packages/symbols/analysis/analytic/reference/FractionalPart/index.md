---
name: FractionalPart
domain: Elementary functions
signature: FractionalPart(x)
summary: "The fractional part of x, with the sign of x: x minus its integer part."
signatures:
  - call: FractionalPart(x)
    description: x minus [[IntegerPart]](x), with the sign of x.
    library: "@enumeratio/analytic"
    type: (number) -> number
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sage
    template: (($1) - (floor($1) if ($1) >= 0 else ceil($1)))
    arity: 1
    threadArgOnly: 1
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: rust
    template: fract($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: num-rational 0.4.2
      on: 2026-10-16
---

- Keeps the sign of x, unlike compute-engine's native [[Fract]], which always lands in $[0, 1)$: $\mathrm{FractionalPart}(-7/2) = -1/2$, where $\mathrm{Fract}(-7/2) = 1/2$.
- Exact where [[IntegerPart]] is: an exact rational reduces to an exact rational, and a symbolic constant like Pi stays exact and symbolic ($\mathrm{FractionalPart}(\pi) = \pi - 3$).
- Zero exactly on the integers.
- Real domain -- a concretely complex argument is left unevaluated.
