---
name: GraphicsComplex3DBox
domain: Boxes
signature: GraphicsComplex3DBox(primitives, options)
summary: "3-D primitives that share vertices: `Points` lists them, and a primitive names its own by `Indices`."
signatures:
  - call: GraphicsComplex3DBox(primitives, options)
    description: "3-D primitives that share vertices: `Points` lists them, and a primitive names its own by `Indices`."
    library: enumeratio-boxes
    type: (boxes | list, expression*) -> boxes
seeAlso:
  - Graphics3DBox
  - Polygon3DBox
  - Line3DBox
names:
  wolframIdentity: true
---

- A surface is one complex: every grid vertex once in `Points`, and a `Polygon3DBox` whose `Indices` are its quads, so a dense mesh is a flat list of numbers rather than a box per face.
- Wolfram's `GraphicsComplex` takes the points as its first argument; here they are an option, as `Places` is on `GraphicsComplexBox`.
