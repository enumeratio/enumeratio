---
name: Normalize
domain: Collections
signature: Normalize(v)
summary: v divided by its Euclidean norm -- a unit vector in v's direction.
signatures:
  - call: Normalize(v)
    description: v / Sqrt(Total(Abs(v)^2))
    library: enumeratio-combinatorics
    type: (collection<any>, ((any) -> any)?) -> collection<any>
  - call: Normalize(v, f)
    description: v / f(v), a custom norm function
    library: enumeratio-combinatorics
names:
  wolframIdentity: true
attributes:
  - HoldAll
---

- The zero vector is returned unchanged -- there is no direction to normalize it to.
