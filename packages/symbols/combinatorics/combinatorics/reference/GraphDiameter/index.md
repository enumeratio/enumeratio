---
name: GraphDiameter
domain: Collections
signature: GraphDiameter(g)
summary: The greatest eccentricity among all vertices of a [[Graph]].
signatures:
  - call: GraphDiameter(g)
    description: max over v of VertexEccentricity(g, v); PositiveInfinity if g is disconnected.
    library: enumeratio-combinatorics
    type: (value) -> real | signed_infinity
seeAlso:
  - GraphRadius
  - GraphPeriphery
  - VertexEccentricity
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sage
    template: ($1).diameter()
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---
