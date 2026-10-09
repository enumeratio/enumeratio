---
name: Same
domain: Compute engine
signature: Same(any, any*) -> boolean
summary: Structural identity comparison (Epsil `===`). True iff every adjacent pair of operands is structurally identical.
signatures:
  - call: Same(any, any*) -> boolean
    description: as compute-engine declares it
  - call: Same(any, any*) -> boolean
    description: compares the operands' values, so Same(Reverse({1, 2}), {2, 1}) is True, as SameQ.
    library: enumeratio-combinatorics
    type: (any, any*) -> boolean
    overrides: compute-engine
stub: engine
attributes:
  - HoldAll
names:
  wolfram: SameQ
---
