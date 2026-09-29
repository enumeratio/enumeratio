---
name: GraphRadius
domain: Collections
signature: GraphRadius(g)
summary: The smallest eccentricity among all vertices of a [[Graph]].
signatures:
  - call: GraphRadius(g)
    description: min over v of VertexEccentricity(g, v); PositiveInfinity if g is disconnected.
    library: enumeratio-collections
    type: (value) -> real | signed_infinity
seeAlso:
  - GraphDiameter
  - GraphCenter
  - VertexEccentricity
names:
  wolframIdentity: true
---

- radius <= diameter <= 2 * radius always holds for a connected graph.
