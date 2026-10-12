---
name: Polygon3DBox
domain: Boxes
signature: Polygon3DBox(options)
summary: "Polygons in space: `Points` for one, or `Indices` into a complex's points for many, each filled by its entry of `FaceColors`."
signatures:
  - call: Polygon3DBox(options)
    description: "Polygons in space: `Points` for one, or `Indices` into a complex's points for many, each filled by its entry of `FaceColors`."
    library: enumeratio-boxes
    type: (expression*) -> boxes
seeAlso:
  - Graphics3DBox
  - GraphicsComplex3DBox
  - PolygonBox
names:
  wolframIdentity: true
---

- A Wolfram `Polygon` primitive in a `Graphics3D`.
- Drawn back to front on each polygon's mean depth (the painter's algorithm), so overlapping surfaces interleave. `EdgeForm` is the outline, `Opacity` the fill's.
