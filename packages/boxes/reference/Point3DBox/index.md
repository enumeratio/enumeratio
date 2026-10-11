---
name: Point3DBox
domain: Boxes
signature: Point3DBox(options)
summary: "A set of points in space: `Points`."
signatures:
  - call: Point3DBox(options)
    description: "A set of points in space: `Points`."
    library: enumeratio-boxes
    type: (expression*) -> boxes
seeAlso:
  - Graphics3DBox
  - PointBox
  - Line3DBox
names:
  wolframIdentity: true
---

- A Wolfram `Point` primitive in a `Graphics3D`; each point is a dot, smaller and fainter the farther it is (`DepthCue`).
