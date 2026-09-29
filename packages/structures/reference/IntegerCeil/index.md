---
name: IntegerCeil
domain: Structures
signature: IntegerCeil(x)
summary: The least integer at or above x, in a floor ring.
signatures:
  - call: IntegerCeil(x)
    description: The least integer at or above x, in a floor ring.
    library: enumeratio-structures
    type: (any) -> unknown
seeAlso:
  - IntegerFloor
  - Ceil
  - UpperTick
---

- The `FloorRing` protocol's member (Mathlib's `Int.ceil`), and what `Ceil` answers for such a type.
