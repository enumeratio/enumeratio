---
name: GroupBy
domain: Compute engine
signature: "GroupBy(collection<T>, key: (T) any -> unknown) -> dictionary<list> where T"
summary: Partition the collection into a dictionary of lists based on the key returned by the function.
signatures:
  - call: "GroupBy(collection<T>, key: (T) any -> unknown) -> dictionary<list> where T"
    description: as compute-engine declares it
stub: engine
names:
  wolframIdentity: true
---
