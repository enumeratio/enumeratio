---
name: VertexIndex
domain: Collections
signature: VertexIndex(g, v)
summary: The 1-based position of a vertex in a [[Graph]]'s VertexList.
signatures:
  - call: VertexIndex(g, v)
    description: the position of v in VertexList(g); unevaluated if v is not a vertex of g.
    library: enumeratio-combinatorics
    type: (value, any) -> integer
seeAlso:
  - VertexList
  - VertexDegree
names:
  wolframIdentity: true
---
