---
name: NotEqual
domain: Compute engine
signature: NotEqual(any, any) -> boolean
summary: Inequality comparison (not equal to).
signatures:
  - call: NotEqual(any, any) -> boolean
    description: as compute-engine declares it
  - call: NotEqual(any, any) -> boolean
    description: Inequality comparison (not equal to).
    library: enumeratio-adeles
    type: (any, any) -> boolean
    overrides: enumeratio-residues
    on:
      - Adele
      - Idele
      - ProfiniteNumber
  - call: NotEqual(any, any) -> boolean
    description: Inequality comparison (not equal to).
    library: enumeratio-residues
    type: (any, any) -> boolean
    overrides: compute-engine
    on:
      - IntegerMod
names:
  wolfram: Unequal
stub: engine
attributes:
  - HoldAll
---
