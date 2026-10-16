---
name: VertexCount
domain: Collections
signature: VertexCount(g)
summary: How many vertices a [[Graph]] has.
signatures:
  - call: VertexCount(g)
    description: $|V(g)|$.
    library: enumeratio-combinatorics
    type: (value) -> integer
seeAlso:
  - VertexList
  - EdgeCount
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sage
    template: ($1).order()
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---
