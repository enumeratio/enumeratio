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
- The digits argument must be an integer; [[Floor]] and [[Ceil]] take a step instead (a multiple to round to), not a digit count.
- Differs from Wolfram, Sage and Python in the tie rule: $\mathrm{Round}(5/2) = 3$, $\mathrm{Round}(7/2) = 4$ and $\mathrm{Round}(-5/2) = -3$ here (compute-engine's half away from zero), while Wolfram, Sage and Python's `round` round a tie to the even integer and give 2, 4 and $-2$. Only exact ties differ.
- Differs from Wolfram in the second argument: ours counts decimal places ($\mathrm{Round}(3.14159, 2) = 3.14$, and $\mathrm{Round}(226, -1) = 230$), while Wolfram's `Round[x, a]` rounds to the nearest multiple of $a$ (`Round[226, 10]` is 230, `Round[3.14159, 0.01]` is 3.14). Here $\mathrm{Round}(226, 10)$ rounds to ten decimal places and leaves 226 alone. Python's `round(226, -1)` counts digits like ours.
- [[Floor]] and [[Ceil]] take a step like Wolfram's, so $\mathrm{Floor}(226, 10) = 220$ and $\mathrm{Ceil}(226, 10) = 230$ agree with `Floor[226, 10]` and `Ceiling[226, 10]`; only Round's second argument means something else. For a Wolfram-style multiple, write $\mathrm{Round}(x/a) \cdot a$ (and mind the tie rule above).
- Rounding modes are a compute-engine question, not settled here; behaviour is unchanged.
