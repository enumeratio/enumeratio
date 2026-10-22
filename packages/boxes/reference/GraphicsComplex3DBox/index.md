---
name: GraphicsComplex3DBox
domain: Boxes
signature: GraphicsComplex3DBox(coordinates, primitives, options)
summary: "3-D primitives that share vertices: the first operand lists them, and a primitive names its own by `Indices`."
signatures:
  - call: GraphicsComplex3DBox(coordinates, primitives, options)
    description: "3-D primitives that share vertices: the first operand lists them, and a primitive names its own by `Indices`."
    library: enumeratio-boxes
    type: (list, boxes | list, expression*) -> boxes
seeAlso:
  - Graphics3DBox
  - Polygon3DBox
  - Line3DBox
names:
  wolframIdentity: true
---

- A surface is one complex: every grid vertex once in the coordinates, and a `Polygon3DBox` whose `Indices` are its quads, so a dense mesh is a flat list of numbers rather than a box per face.
- As in Wolfram, the coordinates are the first operand and the primitives the second.
