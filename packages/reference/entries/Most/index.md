---
name: Most
domain: Compute engine
signature: "Most((T) -> T where T: string) & ((indexed_collection<T>) -> list<T> where T)"
summary: Return the collection without the last element. If the collection has only one element, return an empty collection.
signatures:
  - call: "Most((T) -> T where T: string) & ((indexed_collection<T>) -> list<T> where T)"
    description: as compute-engine declares it
names:
  wolframIdentity: true
stub: engine
bindings:
  - origin: mapped
    form: mathlib4
    template: (List.dropLast $1)
    arity: 1
    note: The list without its last element; the empty list stays empty, as ours does.
---
