---
name: EdgeCount
domain: Collections
signature: EdgeCount(g)
summary: How many edges a [[Graph]] has.
signatures:
  - call: EdgeCount(g)
    description: $|E(g)|$.
    library: enumeratio-combinatorics
    type: (value) -> integer
seeAlso:
  - VertexCount
  - EdgeList
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sage
    template: ($1).size()
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---
