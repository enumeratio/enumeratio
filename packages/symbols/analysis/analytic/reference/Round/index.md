---
name: Round
domain: Arithmetic
signature: Round(x, a?)
summary: Rounds x to the nearest integer, or to the nearest multiple of a.
signatures:
  - call: Round(x)
    description: rounds x to the nearest integer, ties away from 0.
  - call: Round(x, a)
    description: rounds to the nearest multiple of the step a.
  - call: Round(x, a?)
    description: Rounds x to the nearest integer, or to the nearest multiple of a.
    library: enumeratio-analytic
    type: "(x: real | signed_infinity, step: real?) -> real | signed_infinity"
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
---

- Rounds to the nearest integer, with ties (an exact .5) breaking away from 0: $\mathrm{Round}(2.5) = 3$ and $\mathrm{Round}(-2.5) = -3$.
- A second argument a rounds to the nearest multiple of a, as in Wolfram: $\mathrm{Round}(226, 10) = 230$ and $\mathrm{Round}(3.14159, 1/100) = 157/50$. A step of 1 agrees with the 1-argument form.
- Threads element-wise over a list.
- [[Floor]] and [[Ceil]] take a step the same way.
- Differs from Wolfram, Sage and Python in the tie rule: $\mathrm{Round}(5/2) = 3$, $\mathrm{Round}(7/2) = 4$ and $\mathrm{Round}(-5/2) = -3$ here (compute-engine's half away from zero), while Wolfram, Sage and Python's `round` round a tie to the even integer and give 2, 4 and $-2$. Only exact ties differ.
- Python's `round(x, n)` counts digits: its `round(x, 2)` is $\mathrm{Round}(x, 1/100)$ here.
- Ties follow compute-engine's `roundingTies` setting, away from zero by default.
