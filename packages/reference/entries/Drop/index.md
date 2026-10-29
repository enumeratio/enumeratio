---
name: Drop
domain: Compute engine
signature: "Drop((xs: T, count: number) -> T where T: string) & ((xs: indexed_collection<T>, count: number) -> list<T> where T)"
summary: Return the collection without the first n elements.
signatures:
  - call: "Drop((xs: T, count: number) -> T where T: string) & ((xs: indexed_collection<T>, count: number) -> list<T> where T)"
    description: as compute-engine declares it
names:
  wolframIdentity: true
stub: engine
bindings:
  - origin: mapped
    form: mathlib4
    template: "(if ($2 : ℤ) ≥ 0 then ($1).drop ($2 : ℤ).toNat else ($1).take (($1).length - (-($2 : ℤ)).toNat))"
    arity: 2
    note: The list without its first n elements, or its last n when negative; a count past the length clamps to the empty list, as ours does. A non-integer count fails to elaborate.
---
