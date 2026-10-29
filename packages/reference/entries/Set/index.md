---
name: Set
domain: Compute engine
signature: Set(any*) -> set
summary: An unordered collection of distinct elements (a set).
signatures:
  - call: Set(any*) -> set
    description: as compute-engine declares it
stub: engine
bindings:
  - origin: mapped
    form: mathlib4
    template: "(List.dedup ([$*,] : List ℚ))"
    note: a Set is passed to Lean as a duplicate-free list of rationals, which is how the lane hands sets to Finset functions (they read it with List.toFinset); element order is not meaningful
---
