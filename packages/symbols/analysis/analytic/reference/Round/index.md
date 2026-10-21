---
name: Round
domain: Arithmetic
signature: Round(x, a?)
summary: Rounds x to the nearest integer, or to the nearest multiple of a.
signatures:
  - call: Round(x)
    description: rounds x to the nearest integer, a tie to the even one.
  - call: Round(x, a)
    description: rounds to the nearest multiple of the step a.
  - call: Round(x, a?)
    description: Rounds x to the nearest integer, or to the nearest multiple of a.
    library: enumeratio-analytic
    type: "(x: real | signed_infinity | ~oo, step: real?) -> real | signed_infinity | ~oo"
    overrides: compute-engine
  - call: Round(x, a?)
    description: with midpoints between ticks, the nearest tick, a tie going to the even tick when the ticks have a parity, else up; in a floor ring without them, Mathlib's `round` (ties up). In a product order, coordinate by coordinate, so a complex number's parts are rounded separately.
    library: enumeratio-structures
    type: (any, any?) -> any
    overrides: enumeratio-analytic
seeAlso:
  - Floor
  - Ceil
  - Clamp
references:
  - system: wikipedia
    identity: Rounding
  - system: mathworld
    identity: NearestIntegerFunction
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sympy
    template: round($1)
    arity: 1
    threadArg: 1
    checked:
      version: 1.14.0
      on: 2026-10-14
    note: SymPy's round, like Wolfram's, sends a tie to the even integer and rounds a complex number part by part.
  - origin: mapped
    form: sympy
    template: (round(S($1) / ($2)) * ($2))
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.14.0
      on: 2026-10-14
  - origin: mapped
    form: mpmath
    template: nint($1)
    arity: 1
    threadArgOnly: 1
    note: mpmath rounds half to even.
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: sage
    template: round($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: julia
    template: enumeratio_round($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
  - origin: mapped
    form: rust
    template: round($1)
    arity: 1
    threadArgOnly: 1
    note: Ties go away from zero, as num-rational's `round` and std's do.
    checked:
      version: num-rational 0.4.2
      on: 2026-10-16
---

- Rounds to the nearest integer, with ties (an exact .5) going to the even one, as in Wolfram, Sage, SymPy, mpmath and Python: $\mathrm{Round}(2.5) = 2$, $\mathrm{Round}(3.5) = 4$ and $\mathrm{Round}(-2.5) = -2$.
- A second argument a rounds to the nearest multiple of a, as in Wolfram: $\mathrm{Round}(226, 10) = 230$ and $\mathrm{Round}(3.14159, 1/100) = 157/50$. A step of 1 agrees with the 1-argument form.
- Threads element-wise over a list.
- [[Floor]] and [[Ceil]] take a step the same way.
- Differs from Rust's `round`, and from compute-engine's own default, in the tie rule: both send a tie away from zero, so $\mathrm{Round}(5/2) = 3$ there where it is $2$ here. Only exact ties differ.
- Python's `round(x, n)` counts digits: its `round(x, 2)` is $\mathrm{Round}(x, 1/100)$ here.
- Ties follow the engine's `roundingTies` setting, which every engine we ship sets to `to-even`; compute-engine's default is away from zero.
