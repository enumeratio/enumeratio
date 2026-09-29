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

- The `MidpointOrder` protocol's member: `Round` compares a value against the midpoint between the ticks either side of it.
- Mathlib's `midpoint`, and Wolfram's `Midpoint` of the segment between a and b. `MidpointOrder` itself is our extension: Mathlib has no protocol for it.
