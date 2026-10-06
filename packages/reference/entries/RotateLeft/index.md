---
name: RotateLeft
domain: Compute engine
signature: "RotateLeft((T, integer?) -> T where T: string) & ((T, integer?) -> T where T: list) & ((indexed_collection<T>, integer?) -> list<T> where T)"
summary: Rotate the elements of the collection to the left by n positions.
signatures:
  - call: "RotateLeft((T, integer?) -> T where T: string) & ((T, integer?) -> T where T: list) & ((indexed_collection<T>, integer?) -> list<T> where T)"
    description: as compute-engine declares it
stub: engine
names:
  wolframIdentity: true
---
