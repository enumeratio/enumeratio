---
name: Round
domain: Arithmetic
signature: Round(x, n?)
summary: Rounds x to the nearest integer, or to n decimal places.
signatures:
  - call: Round(x)
    description: rounds x to the nearest integer, ties away from 0.
  - call: Round(x, n)
    description: "rounds to the nearest $10^{-n}$: n decimal places, or -- for negative n -- the nearest power of ten."
  - call: Round(x, n?)
    description: Rounds x to the nearest integer, or to n decimal places.
    library: enumeratio-analytic
    type: (real | signed_infinity, integer?) -> real | signed_infinity
    overrides: compute-engine
  - call: Round(x, n?)
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
- A second, integer argument n rounds to the nearest $10^{-n}$ instead: positive n gives n decimal places, negative n rounds to the nearest power of ten.
- $\mathrm{Round}(x, 0)$ agrees with the 1-argument form.
- Threads element-wise over a list.
- The digits argument must be an integer; unlike [[Floor]] and [[Ceil]], which take no second argument at all, Round is the only one of the three with quantized rounding.
