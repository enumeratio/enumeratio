---
name: VertexList
domain: Collections
signature: VertexList(g)
summary: The vertices of a [[Graph]], in first-appearance order.
signatures:
  - call: VertexList(g)
    description: every vertex of $g$, in the order [[Graph]]'s doc describes.
    library: enumeratio-combinatorics
    type: (value) -> list<any>
seeAlso:
  - Graph
  - EdgeList
  - VertexCount
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sage
    template: list(($1).vertices(sort=False))
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---
