---
name: IsEvenTick
domain: Structures
signature: IsEvenTick(t)
summary: Whether a tick is an even one, in a type whose ticks have a parity.
signatures:
  - call: IsEvenTick(t)
    description: Whether a tick is an even one, in a type whose ticks have a parity.
    library: enumeratio-structures
    type: (any) -> unknown
details:
  - "The `TickParity` protocol's member: with it, `Round` breaks a tie toward the even tick, Wolfram's rule."
  - "`TickParity` is our extension of Mathlib, whose `round` sends ties up."
seeAlso:
  - Round
  - LowerTick
---
