---
name: Floor
domain: Arithmetic
signature: Floor(x)
summary: 'The greatest integer less than or equal to x: $\lfloor x \rfloor$.'
signatures:
  - call: Floor(x)
    description: the greatest integer $\le x$, $\lfloor x \rfloor$.
  - call: Floor(x, step)
    description: the greatest multiple of `step` at or below x.
  - call: Floor(x)
    description: 'The greatest integer less than or equal to x: $\lfloor x \rfloor$.'
    library: enumeratio-analytic
    type: "(x: real | signed_infinity, step: real?) -> real | signed_infinity"
    overrides: compute-engine
  - call: Floor(x)
    description: in a floor ring (Mathlib's), the greatest integer at or below x; in a floor order, the greatest tick at or below x; in a product order, coordinate by coordinate, so a complex number's real and imaginary parts are floored separately.
    library: enumeratio-structures
    type: (any, any?) -> any
    overrides: enumeratio-analytic
seeAlso:
  - Ceil
  - Round
references:
  - system: wikipedia
    identity: Floor and ceiling functions
  - system: mathworld
    identity: FloorFunction
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: oscar
    template: floor(BigInt, $1)
    arity: 1
  - origin: mapped
    form: wolfram
    template: Floor[$1]
    arity: 1
  - origin: mapped
    form: sympy
    template: floor($1)
    arity: 1
    threadArg: 1
  - origin: mapped
    form: mpmath
    template: floor($1)
    arity: 1
  - origin: mapped
    form: sage
    template: enumeratio_floor($1)
    arity: 1
  - origin: mapped
    form: rust
    template: floor($1)
    arity: 1
---

- The greatest integer $\le x$: $\lfloor x \rfloor$.
- Rounds toward $-\infty$, not toward 0 -- so $\lfloor -3.5 \rfloor = -4$, not $-3$.
- For a non-integer x, $\lceil x \rceil = \lfloor x \rfloor + 1$. See [[Ceil]].
- $\lfloor -x \rfloor = -\lceil x \rceil$.
- Threads element-wise over a list.
- A second argument floors to the nearest multiple of it -- the step needn't be an integer.
- The second argument is a step, a multiple to floor to, as in Wolfram's `Floor[x, a]`: $\mathrm{Floor}(226, 10) = 220$. [[Round]]'s second argument is a step too. Round breaks ties away from zero where Wolfram rounds them to even (see [[Round]]).
