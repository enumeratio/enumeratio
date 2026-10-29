---
name: Take
domain: Compute engine
signature: "Take((xs: T, count: number) -> T where T: string) & ((xs: indexed_collection<T>, count: number) -> list<T> where T)"
summary: Return `n` elements from a collection.
signatures:
  - call: "Take((xs: T, count: number) -> T where T: string) & ((xs: indexed_collection<T>, count: number) -> list<T> where T)"
    description: as compute-engine declares it
names:
  wolframIdentity: true
stub: engine
bindings:
  - origin: mapped
    form: mathlib4
    template: "(if ($2 : ℤ) ≥ 0 then ($1).take ($2 : ℤ).toNat else ($1).drop (($1).length - (-($2 : ℤ)).toNat))"
    arity: 2
    note: A count from the front, or from the end when negative; a count past the length clamps to the whole list, as ours does. An index-pair count, UpTo and a non-integer count fail to elaborate.
---
