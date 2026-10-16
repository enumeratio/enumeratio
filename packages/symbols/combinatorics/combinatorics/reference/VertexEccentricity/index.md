---
name: VertexEccentricity
domain: Collections
signature: VertexEccentricity(g, v)
summary: The greatest distance from a vertex to any other vertex of a [[Graph]].
signatures:
  - call: VertexEccentricity(g)
    description: the eccentricity of every vertex, in VertexList(g) order.
    library: enumeratio-combinatorics
    type: (value, any?) -> list<real | signed_infinity> | real | signed_infinity
  - call: VertexEccentricity(g, v)
    description: just v's eccentricity.
    library: enumeratio-combinatorics
seeAlso:
  - GraphRadius
  - GraphDiameter
  - GraphCenter
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sage
    template: ($1).eccentricity($2)
    arity: 2
    checked:
      version: "10.9"
      on: 2026-10-16
---

- The moment any OTHER vertex is unreachable from v, the eccentricity is PositiveInfinity -- not just the max over whatever happens to be reachable.
- Distances respect edge direction, same as [[GraphDistance]].
