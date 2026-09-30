---
name: Midpoint
domain: Structures
signature: Midpoint(a, b)
summary: The point halfway between two values.
signatures:
  - call: Midpoint(a, b)
    description: The point halfway between two values.
    library: enumeratio-structures
    type: (any, any) -> unknown
seeAlso:
  - LowerTick
  - UpperTick
  - Round
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: wolfram
    template: Midpoint[{$1, $2}]
    arity: 2
    note: Wolfram's takes the segment as one list of its two ends.
---

- The `AffineMidpoint` protocol's member: numbers, complex numbers, and lists componentwise, so vectors, matrices and `Point`s have midpoints too. Two lists of different shapes have none.
- `Round` uses it through `MidpointOrder` (ticks plus midpoints), comparing a value against the midpoint between the ticks either side of it.
- Mathlib's `midpoint`, defined on an affine space over a ring where 2 is invertible, and Wolfram's `Midpoint` of the segment between a and b. The protocols themselves are our extension: Mathlib has no class for either.
