---
name: WithCoordinates
domain: Structures
signature: WithCoordinates(x, coordinates)
summary: A value shaped like x with the given coordinates.
signatures:
  - call: WithCoordinates(x, coordinates)
    description: A value shaped like x with the given coordinates.
    library: enumeratio-structures
    type: (any, any) -> unknown
details:
  - The `ProductOrder` protocol's member that rebuilds a value from its coordinates; x picks the implementation, since a bare list can't.
seeAlso:
  - Coordinates
---
