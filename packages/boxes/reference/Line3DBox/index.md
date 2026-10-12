---
name: Line3DBox
domain: Boxes
signature: Line3DBox(options)
summary: A path in space through `Points` (or a complex's `Indices`), `VertexColors` giving the color at each point.
signatures:
  - call: Line3DBox(options)
    description: A path in space through `Points` (or a complex's `Indices`), `VertexColors` giving the color at each point.
    library: enumeratio-boxes
    type: (expression*) -> boxes
seeAlso:
  - Graphics3DBox
  - LineBox
  - Point3DBox
names:
  wolframIdentity: true
---

- A Wolfram `Line` primitive in a `Graphics3D`.
- `Casing -> True` lays a background stroke under each arc so the nearer strand erases the farther where two cross: the over and under of a knot diagram.
